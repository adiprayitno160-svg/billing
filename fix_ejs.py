import os

path = r"c:\laragon\www\billing\views\customers\edit.ejs"
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# We look for a unique substring in the broken block
broken_part = "passed from controller if available if (customer.odp_id"

if broken_part in content:
    print("Found broken content, attempting fix...")
    
    # Define start and end of the messy block as known from view_file
    # Start: line 660, End: line 668
    # We'll use a large enough chunk to be unique
    
    old_block_start = "            <% var initialOdpName='' ; var initialOdcName='' ; var initialOltName='' ; // Try to find names in odpData"
    # We need to match exactly what's in the file. CRLF might be tricky, so we'll normalize or use regex?
    # Simpler: Read lines, identify the range, replace lines.
    
    lines = content.splitlines()
    start_idx = -1
    for i, line in enumerate(lines):
        if "var initialOdpName='' ; var initialOdcName='' ;" in line:
            start_idx = i
            break
            
    if start_idx != -1:
        # We assume the next few lines are the broken ones.
        # We will replace 9 lines (660 to 668 inclusive based on line numbers in view_file)
        # 660 is start_idx.
        
        new_lines = [
            "            <%",
            "                var initialOdpName = '';",
            "                var initialOdcName = '';",
            "                var initialOltName = '';",
            "                ",
            "                // Try to find names in odpData passed from controller if available",
            "                if (customer.odp_id && typeof odpData !== 'undefined' && Array.isArray(odpData)) {",
            "                    var found = odpData.find(function(o) { return String(o.id) === String(customer.odp_id); });",
            "                    if (found) {",
            "                        initialOdpName = found.odp_name;",
            "                        initialOdcName = found.odc_name;",
            "                        initialOltName = found.olt_name || 'Auto';",
            "                    }",
            "                }",
            "                ",
            "                // If not found in odpData but we have names directly on customer object",
            "                if (!initialOdpName && customer.odp_name) initialOdpName = customer.odp_name;",
            "                if (!initialOdcName && customer.odc_name) initialOdcName = customer.odc_name;",
            "                if (!initialOltName && customer.olt_name) initialOltName = customer.olt_name;",
            "            %>"
        ]
        
        # Replace lines start_idx to start_idx + 9
        # Check if the length matches roughly what we expect to replace
        # The broken block was 9 lines in view_file (660-668)
        
        lines[start_idx : start_idx + 9] = new_lines
        
        new_content = "\n".join(lines)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print("File updated successfully via Python.")
        
    else:
        print("Could not find the start line.")

else:
    print("Broken content substring not found. Check file content.")
