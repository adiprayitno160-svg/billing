import os

path = r"c:\laragon\www\billing\views\customers\edit.ejs"
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

broken_part = "passed from controller if available if (customer.odp_id"

if broken_part in content:
    print("Found broken content, fixing...")
    
    # We will look for the specific broken block structure
    token_start = "var initialOltName='' ; // Try to find names in odpData"
    
    # Simple replace of the exact broken string block
    # Note: Using exact strings from the file view output
    
    broken_block = """<% var initialOdpName='' ; var initialOdcName='' ; var initialOltName='' ; // Try to find names in odpData
                passed from controller if available if (customer.odp_id && typeof odpData !=='undefined' &&
                Array.isArray(odpData)) { var found=odpData.find(function(o) { return
                String(o.id)===String(customer.odp_id); }); if (found) { initialOdpName=found.odp_name;
                initialOdcName=found.odc_name; initialOltName=found.olt_name || 'Auto' ; } } // If not found in odpData
                but we have names directly on customer object (sometimes passed via join) if (!initialOdpName &&
                customer.odp_name) initialOdpName=customer.odp_name; if (!initialOdcName && customer.odc_name)
                initialOdcName=customer.odc_name; if (!initialOltName && customer.olt_name)
                initialOltName=customer.olt_name; %>"""

    # We need to be careful with whitespace.
    # Instead, let's locate the line with the comment start and replace the next few lines.
    
    lines = content.splitlines()
    for i, line in enumerate(lines):
        if "var initialOltName='' ; // Try to find names in odpData" in line:
            # Found the start line (approx line 660)
            print(f"Found start at line {i+1}")
            
            # Replace lines i to i+8 (9 lines total) with the clean version
            new_block = [
                "            <% ",
                "                var initialOdpName = ''; ",
                "                var initialOdcName = ''; ",
                "                var initialOltName = ''; ",
                "                ",
                "                // Try to find names in odpData passed from controller if available ",
                "                if (customer.odp_id && typeof odpData !== 'undefined' && Array.isArray(odpData)) { ",
                "                    var found = odpData.find(function(o) { return String(o.id) === String(customer.odp_id); }); ",
                "                    if (found) { ",
                "                        initialOdpName = found.odp_name;",
                "                        initialOdcName = found.odc_name; ",
                "                        initialOltName = found.olt_name || 'Auto'; ",
                "                    } ",
                "                } ",
                "                ",
                "                // If not found in odpData but we have names directly on customer object",
                "                if (!initialOdpName && customer.odp_name) initialOdpName = customer.odp_name; ",
                "                if (!initialOdcName && customer.odc_name) initialOdcName = customer.odc_name; ",
                "                if (!initialOltName && customer.olt_name) initialOltName = customer.olt_name; ",
                "            %>"
            ]
            
            # Replace
            lines[i : i+9] = new_block
            break
            
    new_content = "\n".join(lines)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Fixed file.")

else:
    print("Broken content not found. File might be clean.")
