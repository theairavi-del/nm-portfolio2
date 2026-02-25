// Export projects data from localStorage to downloadable JSON file
function exportProjectsData() {
    const data = localStorage.getItem('nmPortfolioProjects');
    if (!data) {
        alert('No project data found in localStorage');
        return;
    }
    
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'projects-export.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert('Projects exported! Send this file to Vector to update the live site.');
}

// Add export button to admin panel
window.addEventListener('load', () => {
    const header = document.querySelector('.admin-header');
    if (header) {
        const exportBtn = document.createElement('button');
        exportBtn.textContent = '📥 Export Data';
        exportBtn.style.cssText = 'background:#2DD512;color:#000;border:none;padding:8px 16px;margin-left:20px;cursor:pointer;font-weight:500;';
        exportBtn.onclick = exportProjectsData;
        header.appendChild(exportBtn);
    }
});
