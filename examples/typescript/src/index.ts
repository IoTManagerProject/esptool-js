const baudrates = document.getElementById('baudrates') as HTMLSelectElement;
const connectButton = document.getElementById('connectButton') as HTMLButtonElement;
const disconnectButton = document.getElementById('disconnectButton') as HTMLButtonElement;
const resetButton = document.getElementById('resetButton') as HTMLButtonElement;
const consoleStartButton = document.getElementById('consoleStartButton') as HTMLButtonElement;
const consoleStopButton = document.getElementById('consoleStopButton') as HTMLButtonElement;
const eraseButton = document.getElementById('eraseButton') as HTMLButtonElement;
const addFileButton = document.getElementById('addFile') as HTMLButtonElement;
const programButton = document.getElementById('programButton');
const filesDiv = document.getElementById('files');
const terminal = document.getElementById('terminal');
const programDiv = document.getElementById('program');
const consoleDiv = document.getElementById('console');
const lblBaudrate = document.getElementById('lblBaudrate');
const lblConsoleFor = document.getElementById('lblConsoleFor');
const lblConnTo = document.getElementById('lblConnTo');
const table = document.getElementById('fileTable') as HTMLTableElement;
const alertDiv = document.getElementById('alertDiv');

// This is a frontend example of Esptool-JS using local bundle file
// To optimize use a CDN hosted version like
// https://unpkg.com/esptool-js@0.2.0/bundle.js
import { ESPLoader, FlashOptions, LoaderOptions, Transport } from '../../../lib';

declare let Terminal; // Terminal is imported in HTML script
declare let CryptoJS; // CryptoJS is imported in HTML script

const term = new Terminal({ cols: 120, rows: 40 });
term.open(terminal);

let device = null;
let transport: Transport;
let chip: string = null;
let esploader: ESPLoader;

let firmSettings = null;

disconnectButton.style.display = 'none';
eraseButton.style.display = 'none';
consoleStopButton.style.display = 'none';
filesDiv.style.display = 'none';

getFirm();

function getFirm() {
  fetch('https://portaller.cloud/compiler/firmparams/1694120212546', {})
    .then((res) => res.json())
    .then((res) => {
      console.log(res);
      firmSettings = res;
      createTableFromJson();
    })
    .catch((e) => {
      console.log(e);
    });
}

function getFile(url, index) {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  xhr.overrideMimeType('text/plain; charset=x-user-defined');
  xhr.onreadystatechange = function (e) {
    if (this.readyState == 4 && this.status == 200) {
      const binStr = this.responseText;
      console.log('get bin file from url', url);
      firmSettings[index].data = binStr;
    }
  };

  xhr.send();
}

const espLoaderTerminal = {
  clean() {
    term.clear();
  },
  writeLine(data) {
    term.writeln(data);
  },
  write(data) {
    term.write(data);
  },
};

connectButton.onclick = async () => {
  if (device === null) {
    device = await navigator.serial.requestPort({});
    transport = new Transport(device);
  }

  try {
    const flashOptions = {
      transport,
      baudrate: parseInt(baudrates.value),
      terminal: espLoaderTerminal,
    } as LoaderOptions;
    esploader = new ESPLoader(flashOptions);

    chip = await esploader.main_fn();

    // Temporarily broken
    // await esploader.flash_id();
  } catch (e) {
    console.error(e);
    term.writeln(`Error: ${e.message}`);
  }

  console.log('Settings done for :' + chip);
  lblBaudrate.style.display = 'none';
  lblConnTo.innerHTML = 'Connected to device: ' + chip;
  lblConnTo.style.display = 'block';
  baudrates.style.display = 'none';
  connectButton.style.display = 'none';
  disconnectButton.style.display = 'initial';
  eraseButton.style.display = 'initial';
  filesDiv.style.display = 'initial';
  consoleDiv.style.display = 'none';
};

resetButton.onclick = async () => {
  if (device === null) {
    device = await navigator.serial.requestPort({});
    transport = new Transport(device);
  }

  await transport.setDTR(false);
  await new Promise((resolve) => setTimeout(resolve, 100));
  await transport.setDTR(true);
};

eraseButton.onclick = async () => {
  eraseButton.disabled = true;
  try {
    await esploader.erase_flash();
  } catch (e) {
    console.error(e);
    term.writeln(`Error: ${e.message}`);
  } finally {
    eraseButton.disabled = false;
  }
};

function createTableFromJson() {
  if (firmSettings) {
    for (let i = 0; i < firmSettings.length; i++) {
      console.log('------');
      const rowCount = table.rows.length;
      const row = table.insertRow(rowCount);

      //Column 1 - Offset
      const cell1 = row.insertCell(0);
      const element1 = document.createElement('input');
      element1.type = 'text';
      element1.id = 'offset' + rowCount;
      element1.value = firmSettings[i].addr;
      cell1.appendChild(element1);

      //const cell1 = row.insertCell(0);
      //const element1 = document.createElement('p');
      //element1.id = 'offset' + rowCount;
      //element1.innerText = firmSettings[i].addr;
      //cell1.appendChild(element1);

      getFile(firmSettings[i].link, i);

      // Column 2 - File name
      const cell2 = row.insertCell(1);
      const element2 = document.createElement('p');
      element2.id = 'parag' + rowCount;
      let text = firmSettings[i].link;
      text = text.substring(text.lastIndexOf('/') + 1, text.length);
      element2.innerText = text;
      cell2.appendChild(element2);

      // Column 3  - Progress
      const cell3 = row.insertCell(2);
      cell3.classList.add('progress-cell');
      cell3.style.display = 'none';
      cell3.innerHTML = `<progress value="0" max="100"></progress>`;
    }
  }
}

// to be called on disconnect - remove any stale references of older connections if any
function cleanUp() {
  device = null;
  transport = null;
  chip = null;
}

disconnectButton.onclick = async () => {
  if (transport) await transport.disconnect();

  term.clear();
  baudrates.style.display = 'initial';
  connectButton.style.display = 'initial';
  disconnectButton.style.display = 'none';
  eraseButton.style.display = 'none';
  lblConnTo.style.display = 'none';
  filesDiv.style.display = 'none';
  alertDiv.style.display = 'none';
  consoleDiv.style.display = 'initial';
  cleanUp();
};

let isConsoleClosed = false;
consoleStartButton.onclick = async () => {
  if (device === null) {
    device = await navigator.serial.requestPort({});
    transport = new Transport(device);
  }
  lblConsoleFor.style.display = 'block';
  consoleStartButton.style.display = 'none';
  consoleStopButton.style.display = 'initial';
  programDiv.style.display = 'none';

  await transport.connect();
  isConsoleClosed = false;

  while (true && !isConsoleClosed) {
    const val = await transport.rawRead();
    if (typeof val !== 'undefined') {
      term.write(val);
    } else {
      break;
    }
  }
  console.log('quitting console');
};

consoleStopButton.onclick = async () => {
  isConsoleClosed = true;
  await transport.disconnect();
  await transport.waitForUnlock(1500);
  term.clear();
  consoleStartButton.style.display = 'initial';
  consoleStopButton.style.display = 'none';
  programDiv.style.display = 'initial';
};

programButton.onclick = async () => {
  const fileArray = [];
  const progressBars = [];

  for (let index = 1; index < table.rows.length; index++) {
    const row = table.rows[index];

    const offSetObj = row.cells[0].childNodes[0] as HTMLInputElement;
    const offset = parseInt(offSetObj.value);

    const progressBar = row.cells[2].childNodes[0];

    progressBar.textContent = '0';
    progressBars.push(progressBar);

    row.cells[2].style.display = 'initial';
    fileArray.push({ data: firmSettings[index - 1].data, address: offset });
  }

  try {
    const flashOptions: FlashOptions = {
      fileArray: fileArray,
      flashSize: 'keep',
      eraseAll: false,
      compress: true,
      reportProgress: (fileIndex, written, total) => {
        progressBars[fileIndex].value = (written / total) * 100;
      },
      calculateMD5Hash: (image) => CryptoJS.MD5(CryptoJS.enc.Latin1.parse(image)),
    } as FlashOptions;
    await esploader.write_flash(flashOptions);
  } catch (e) {
    console.error(e);
    term.writeln(`Error: ${e.message}`);
  } finally {
    // Hide progress bars and show erase buttons
    for (let index = 1; index < table.rows.length; index++) {
      table.rows[index].cells[2].style.display = 'none';
    }
  }
};
