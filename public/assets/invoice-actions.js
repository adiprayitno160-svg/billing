// Attach handlers for invoice actions (generate current month, etc.)
document.addEventListener('DOMContentLoaded', () => {
  const generateBtn = document.getElementById('generateInvoicesBtn');
  if (generateBtn) {
    generateBtn.addEventListener('click', () => {
      generateBtn.disabled = true;
      generateBtn.classList.add('opacity-75');
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const period = `${yyyy}-${mm}`;
      // Navigate directly to server endpoint so redirect and flash messages work properly
      window.location.href = `/billing/invoices/generate?period=${encodeURIComponent(period)}`;
    });
  }
});


