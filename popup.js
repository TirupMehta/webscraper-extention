document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const scrapeBtn = document.getElementById('scrape-btn');
  const previewBtn = document.getElementById('preview-btn');
  const resultsSection = document.getElementById('results');
  const dataContainer = document.getElementById('data-container');
  const loading = document.getElementById('loading');
  const exportJsonBtn = document.getElementById('export-json');
  const exportCsvBtn = document.getElementById('export-csv');
  const copyClipboardBtn = document.getElementById('copy-clipboard');
  const togglePresetsBtn = document.getElementById('toggle-presets');
  const presetsSection = document.getElementById('presets');
  const presetList = document.getElementById('preset-list');
  const savePresetBtn = document.getElementById('save-preset-btn');
  const deletePresetBtn = document.getElementById('delete-preset-btn');

  let scrapedData = null;

  // Load presets
  loadPresets();

  // Event Listeners
  scrapeBtn.addEventListener('click', handleScrape);
  previewBtn.addEventListener('click', handlePreview);
  exportJsonBtn.addEventListener('click', () => exportData('json'));
  exportCsvBtn.addEventListener('click', () => exportData('csv'));
  copyClipboardBtn.addEventListener('click', copyToClipboard);
  togglePresetsBtn.addEventListener('click', () => {
    presetsSection.style.display = presetsSection.style.display === 'none' ? 'block' : 'none';
  });
  presetList.addEventListener('change', applyPreset);
  savePresetBtn.addEventListener('click', savePreset);
  deletePresetBtn.addEventListener('click', deletePreset);

  // Scrape Handler
  async function handleScrape() {
    const selections = getSelections();
    if (!Object.values(selections).some(Boolean) && !selections.customSelector) {
      alert('Please select at least one option or provide a custom selector.');
      return;
    }

    loading.style.display = 'block';
    resultsSection.style.display = 'none';

    try {
      scrapedData = await scrapeData(selections);
      displayData(scrapedData);
      resultsSection.style.display = 'block';
      resultsSection.classList.add('show');
    } catch (error) {
      console.error('Scraping error:', error);
      dataContainer.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
      resultsSection.style.display = 'block';
    } finally {
      loading.style.display = 'none';
    }
  }

  // Preview Handler
  async function handlePreview() {
    const selector = document.getElementById('custom-selector').value.trim();
    if (!selector) {
      alert('Please enter a custom selector to preview.');
      return;
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: await getActiveTabId() },
        func: previewSelector,
        args: [selector]
      });
    } catch (error) {
      console.error('Preview error:', error);
      alert('Error previewing selector: ' + error.message);
    }
  }

  // Get user selections
  function getSelections() {
    return {
      text: document.getElementById('text').checked,
      links: document.getElementById('links').checked,
      images: document.getElementById('images').checked,
      tables: document.getElementById('tables').checked,
      customSelector: document.getElementById('custom-selector').value.trim()
    };
  }

  // Display scraped data
  function displayData(data) {
    dataContainer.innerHTML = '';
    for (const [key, value] of Object.entries(data)) {
      const section = document.createElement('div');
      section.className = 'data-section';
      const title = document.createElement('h3');
      title.textContent = key.charAt(0).toUpperCase() + key.slice(1);
      title.addEventListener('click', () => section.classList.toggle('collapsed'));
      section.appendChild(title);

      if (key === 'links') {
        const ul = document.createElement('ul');
        value.forEach(link => {
          const li = document.createElement('li');
          const a = document.createElement('a');
          a.href = link;
          a.textContent = link;
          a.target = '_blank';
          li.appendChild(a);
          ul.appendChild(li);
        });
        section.appendChild(ul);
      } else if (key === 'images') {
        value.forEach(src => {
          const img = document.createElement('img');
          img.src = src;
          img.alt = 'Scraped image';
          section.appendChild(img);
        });
      } else if (key === 'tables') {
        value.forEach(tableData => {
          const table = document.createElement('table');
          table.style.border = '1px solid #00ff00';
          tableData.forEach(rowData => {
            const tr = document.createElement('tr');
            rowData.forEach(cell => {
              const td = document.createElement('td');
              td.textContent = cell;
              td.style.border = '1px solid #00ff00';
              tr.appendChild(td);
            });
            table.appendChild(tr);
          });
          section.appendChild(table);
        });
      } else {
        const p = document.createElement('p');
        p.textContent = Array.isArray(value) ? value.join('\n') : value;
        section.appendChild(p);
      }
      dataContainer.appendChild(section);
    }
  }

  // Export data
  function exportData(format) {
    if (!scrapedData) return;
    let content, fileName, mimeType;
    if (format === 'json') {
      content = JSON.stringify(scrapedData, null, 2);
      fileName = 'scraped-data.json';
      mimeType = 'application/json';
    } else {
      content = convertToCsv(scrapedData);
      fileName = 'scraped-data.csv';
      mimeType = 'text/csv';
    }
    downloadFile(content, fileName, mimeType);
  }

  // Copy to clipboard
  function copyToClipboard() {
    if (!scrapedData) return;
    navigator.clipboard.writeText(JSON.stringify(scrapedData, null, 2))
      .then(() => alert('Data copied to clipboard!'))
      .catch(err => alert('Failed to copy: ' + err.message));
  }

  // Download file
  function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Convert to CSV
  function convertToCsv(data) {
    let csv = '';
    for (const [key, value] of Object.entries(data)) {
      csv += `${key}\n`;
      if (key === 'tables') {
        value.forEach((table, index) => {
          csv += `Table ${index + 1}\n`;
          table.forEach(row => csv += `"${row.join('","')}"\n`);
          csv += '\n';
        });
      } else if (Array.isArray(value)) {
        value.forEach(item => csv += `"${item}"\n`);
        csv += '\n';
      } else {
        csv += `"${value}"\n\n`;
      }
    }
    return csv;
  }

  // Preset Management
  function loadPresets() {
    chrome.storage.sync.get('presets', ({ presets = {} }) => {
      presetList.innerHTML = '<option value="">Select a preset</option>';
      for (const [name] of Object.entries(presets)) {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        presetList.appendChild(option);
      }
    });
  }

  function applyPreset() {
    const presetName = presetList.value;
    if (!presetName) return;
    chrome.storage.sync.get('presets', ({ presets }) => {
      const preset = presets[presetName];
      document.getElementById('text').checked = preset.text;
      document.getElementById('links').checked = preset.links;
      document.getElementById('images').checked = preset.images;
      document.getElementById('tables').checked = preset.tables;
      document.getElementById('custom-selector').value = preset.customSelector || '';
    });
  }

  function savePreset() {
    const name = prompt('Enter preset name:');
    if (!name) return;
    const selections = getSelections();
    chrome.storage.sync.get('presets', ({ presets = {} }) => {
      presets[name] = selections;
      chrome.storage.sync.set({ presets }, () => {
        loadPresets();
        alert('Preset saved!');
      });
    });
  }

  function deletePreset() {
    const name = presetList.value;
    if (!name) return;
    chrome.storage.sync.get('presets', ({ presets }) => {
      delete presets[name];
      chrome.storage.sync.set({ presets }, () => {
        loadPresets();
        alert('Preset deleted!');
      });
    });
  }
});

// Scrape Data
async function scrapeData(selections) {
  const tabId = await getActiveTabId();
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: performScraping,
    args: [selections]
  });
  return result[0].result;
}

async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab.id;
}

function performScraping(selections) {
  const data = {};
  if (selections.text) {
    data.text = document.body.innerText.trim();
  }
  if (selections.links) {
    data.links = Array.from(document.querySelectorAll('a[href]'))
      .map(a => a.href)
      .filter(href => href && !href.startsWith('#'));
  }
  if (selections.images) {
    data.images = Array.from(document.querySelectorAll('img[src]'))
      .map(img => img.src)
      .filter(src => src);
  }
  if (selections.tables) {
    data.tables = Array.from(document.querySelectorAll('table')).map(table => {
      return Array.from(table.querySelectorAll('tr')).map(row =>
        Array.from(row.querySelectorAll('td, th')).map(cell => cell.innerText.trim())
      );
    });
  }
  if (selections.customSelector) {
    try {
      data.custom = Array.from(document.querySelectorAll(selections.customSelector))
        .map(el => el.innerText.trim())
        .filter(text => text);
    } catch (e) {
      data.custom = 'Invalid selector provided';
    }
  }
  return data;
}

// Preview Selector
function previewSelector(selector) {
  const elements = document.querySelectorAll(selector);
  if (!elements.length) {
    alert('No elements match this selector.');
    return;
  }
  const style = document.createElement('style');
  style.textContent = `${selector} { outline: 2px solid #ff00ff; background: rgba(255, 0, 255, 0.1); }`;
  document.head.appendChild(style);
  setTimeout(() => document.head.removeChild(style), 3000);
}