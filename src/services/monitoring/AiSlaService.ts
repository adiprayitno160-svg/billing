import { GoogleGenerativeAI } from "@google/generative-ai";
import { databasePool } from '../../db/pool';

// Helper for date formatting
const formatDate = (date: Date) => date.toISOString().slice(0, 19).replace('T', ' ');

export class AiSlaService {

    /**
     * Generate an AI-powered SLA report for a specific customer and month
     * @param customerId 
     * @param month 
     * @param year 
     */
    static async generateSlaReport(customerId: number, month: number, year: number) {
        // 1a. Fetch Customer Ignore Schedule
        const [customerRows] = await databasePool.query<any[]>(
            "SELECT ignore_monitoring_start, ignore_monitoring_end FROM customers WHERE id = ?",
            [customerId]
        );
        const ignoreStart = customerRows[0]?.ignore_monitoring_start; // e.g., "22:00:00"
        const ignoreEnd = customerRows[0]?.ignore_monitoring_end;     // e.g., "06:00:00"

        // 1b. Fetch Logs
        const startDate = `${year}-${month.toString().padStart(2, '0')}-01 00:00:00`;
        const endDateObj = new Date(year, month, 0); // Last day of month
        const endDate = `${year}-${month.toString().padStart(2, '0')}-${endDateObj.getDate()} 23:59:59`;

        const [logs] = await databasePool.query<any[]>(`
            SELECT timestamp, status, disconnect_reason 
            FROM connection_logs 
            WHERE customer_id = ? 
            AND timestamp BETWEEN ? AND ?
            ORDER BY timestamp ASC
        `, [customerId, startDate, endDate]);

        // 2. Identify Outages & Calculate Durations
        let outages = [];
        let currentOutage = null;

        for (const log of logs) {
            if (log.status === 'offline') {
                if (!currentOutage) {
                    currentOutage = {
                        start: log.timestamp,
                        end: null,
                        reason: log.disconnect_reason || 'Unknown',
                        duration_mins: 0,
                        original_duration_mins: 0,
                        ignored_mins: 0
                    };
                }
            } else if (log.status === 'online') {
                if (currentOutage) {
                    currentOutage.end = log.timestamp;
                    const end = new Date(currentOutage.end);
                    const start = new Date(currentOutage.start);
                    currentOutage.original_duration_mins = (end.getTime() - start.getTime()) / 60000;
                    currentOutage.duration_mins = currentOutage.original_duration_mins;
                    outages.push(currentOutage);
                    currentOutage = null;
                }
            }
        }

        // Handle outage that extends beyond periods end (or is still ongoing at report time)
        if (currentOutage) {
            currentOutage.end = new Date(endDate); // Cap at end of month or now
            const end = new Date(currentOutage.end);
            const start = new Date(currentOutage.start);
            currentOutage.original_duration_mins = (end.getTime() - start.getTime()) / 60000;
            currentOutage.duration_mins = currentOutage.original_duration_mins;
            outages.push(currentOutage);
        }

        // 3. Post-process: Subtract Ignored Time
        if (ignoreStart && ignoreEnd) {
            outages = outages.map(outage => {
                const ignoredMinutes = AiSlaService.calculateIgnoredMinutes(
                    new Date(outage.start),
                    new Date(outage.end),
                    ignoreStart,
                    ignoreEnd
                );

                return {
                    ...outage,
                    ignored_mins: ignoredMinutes,
                    duration_mins: Math.max(0, outage.original_duration_mins - ignoredMinutes)
                };
            });
        }

        // 3a. Filter out outages that became 0 minutes
        outages = outages.filter(o => o.duration_mins > 0);

        // 4. AI Analysis
        let aiCommentary = "AI analysis not available.";

        // Initialize Gemini
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey) {
            try {
                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({ model: "gemini-pro" });

                const prompt = `
                    You are a Senior Network Reliability Engineer. Analyze the connection stability for Customer #${customerId} for the period ${month}/${year}.

                    Configuration:
                    - Maintenance Window (Ignored): ${ignoreStart || 'None'} to ${ignoreEnd || 'None'}
                    
                    Outage Incidents (Net Duration > 0 mins):
                    ${JSON.stringify(outages.slice(0, 50))} 
                    
                    Task:
                    Provide a professional executive summary for the ISP and the Customer.
                    1. Assign a Reliability Score (0-10) based on stability.
                    2. Summarize key patterns (e.g., "Frequent short drops during business hours" vs "Stable with one major incident").
                    3. If stability is > 99%, explicitly mention the excellent connection quality.
                    4. Analyzes if outages are occurring just outside the maintenance window.
                    
                    Keep the tone professional, reassuring, and technical but accessible. Max 150 words.
                `;

                const result = await model.generateContent(prompt);
                const response = await result.response;
                aiCommentary = response.text();
            } catch (e) {
                console.error("AI Generation Error:", e);
                aiCommentary = "AI Service Error: " + (e.message || "Unknown error");
            }
        } else {
            console.warn("GEMINI_API_KEY not found in env");
        }

        // 5. Calculate Stats
        // Total minutes in the month
        const totalMinutes = endDateObj.getDate() * 24 * 60;
        const totalOutageMinutes = outages.reduce((acc, curr) => acc + curr.duration_mins, 0);
        const slaPercentage = Math.max(0, ((totalMinutes - totalOutageMinutes) / totalMinutes) * 100);

        return {
            period: `${year}-${month.toString().padStart(2, '0')}`,
            sla_percentage: slaPercentage.toFixed(2),
            total_downtime_minutes: totalOutageMinutes.toFixed(2),
            incident_count: outages.length,
            ai_analysis: aiCommentary,
            outages: outages
        };
    }

    /**
     * Calculate how many minutes of the outage fall within the ignored time window.
     */
    static calculateIgnoredMinutes(start: Date, end: Date, ignoreStartStr: string, ignoreEndStr: string): number {
        // Parse "HH:mm:ss" to minutes from midnight
        const parseTime = (str: string) => {
            const [h, m] = str.split(':').map(Number);
            return h * 60 + m;
        };

        const ignoreStartMins = parseTime(ignoreStartStr);
        const ignoreEndMins = parseTime(ignoreEndStr);

        let totalIgnored = 0;

        // Clone start to avoid mutation
        let iterStart = new Date(start);

        while (iterStart < end) {
            // Determine the "day" associated with current iteration
            // We verify if current minute of iterStart is in ignored window

            const currentMins = iterStart.getHours() * 60 + iterStart.getMinutes();

            let isIgnored = false;

            if (ignoreStartMins < ignoreEndMins) {
                // Window is within same day (e.g. 12:00 to 14:00)
                if (currentMins >= ignoreStartMins && currentMins < ignoreEndMins) {
                    isIgnored = true;
                }
            } else {
                // Window crosses midnight (e.g. 22:00 to 06:00)
                // Ignored if after 22:00 OR before 06:00
                if (currentMins >= ignoreStartMins || currentMins < ignoreEndMins) {
                    isIgnored = true;
                }
            }

            if (isIgnored) {
                totalIgnored++;
            }

            // Advance 1 minute
            iterStart.setMinutes(iterStart.getMinutes() + 1);
        }

        return totalIgnored;
    }
}
