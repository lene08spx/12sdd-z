// Copyright (C) 2020 - Oliver Lenehan - GNU GPLv3.0

//@ts-nocheck
///<reference lib="dom"/>

/**
 * @param {string} code 
 * @param {Record<string,any>} data 
 * @returns {Promise<Record<string,any>>} 
 */
async function op(code, data) {
  const result = await fetch("/op/"+code,{
    body: JSON.stringify(data),
    method: "POST",
    headers: [
      ["Content-Type", "application/json"]
    ],
  });
  return result.json()
}

async function compileAndRun() {
  const sourceCode = document.getElementById('editor-input').value;
  const hash = await op('compile', sourceCode);
  window.open(`/execute?id=${hash}`);
}

let sock = WebSocket.prototype;

async function connectProcess() {
  const hash = new URL(location.href).searchParams.get("id");
  sock = new WebSocket(`ws://localhost:2020/op/run?id=${hash}`);
  const output = document.getElementById("execute-output");
  sock.addEventListener("message", async e=>{
    output.textContent += await e.data.text()+"\n";
  });
}

async function sendInput() {
  const inputEle = document.getElementById("execute-input");
  sock.send(inputEle.value);
  inputEle.value = "";
}
