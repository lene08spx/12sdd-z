// Copyright (C) 2020 - Oliver Lenehan - GNU GPLv3.0

//@ts-nocheck
///<reference lib="dom"/>

/** @type {HTMLTextAreaElement} */
const sourceCode = document.getElementById('editor-input');
const sourceHighlight = document.getElementById('editor-preview');
const sourceMain = document.getElementById('editor-main');

const $ = document.querySelector.bind(document);
let socket = null;

const pageStorage = window["localStorage"];
if (sourceMain !== null) {
  window.addEventListener("load",e=>{
    sourceCode.value = pageStorage.getItem("userCode");
    updateCodePreview();
  });
}

const zedTokenRules = {
  "keyword": /(?<keyword>\b(?:PROG|ENDPROG|DO|ENDDO|OUT|IN|IF|OTHERWISE|ENDIF|SWITCH|ENDSWITCH|FOR|FROM|TO|BY|ENDFOR|WHEN|ENDWHEN|REPEAT|UNTIL|ENDREPEAT)\b)/,
  "operator": /(?<operator>\+|-|\*|\/|>=|<=|>|<|==|&&|\|\||!|:|\[|\]|=|%)/,
  "string": /(?<string>"[ !#-~]*")/,
  "number": /(?<number>\b\d+(?:\.\d+)?\b)/,
  "variable": /(?<variable>\b[A-Z]\d+\b)/,
  "identifier": /(?<identifier>\b[A-Za-z_]+\b)/,
  "comment": /(?<comment>#.*)/,
  "other": /(?<other>[^\s]+)/,
};
const zedToken = new RegExp(Object.values(zedTokenRules).map(v=>v.source).join("|"), "g");

function tokenFromMatch(m) {
  // retrieve the entry in m.groups which is not undefined, this is the right token type and holds the desired value
  const [ tokType, tokValue ] = Object.entries(m.groups??{}).filter(v=>v[1]!==undefined)[0];
  return {
    type: tokType,
    value: tokValue,
    line: 0,
    position: m.index ?? 0,
    absolutePos: 0,
  };
}

/** Perform lexical analysis on source code, returning a list of tokens. */
function lex(source) {
  const lines = source.split(/\r?\n/);
  const tokenList = [];
  for (let i = 0; i < lines.length; i++) {
    const tokenMatches = lines[i].matchAll(zedToken);
    for (let match of tokenMatches) {
      const token = tokenFromMatch(match);
      token.line = i+1;
      token.absolutePos = lines.slice(0, i).join('').length+token.position+i;//+i for newlines
      tokenList.push(token);
    }
  }
  return tokenList;
}


function delay(ms){return new Promise(r=>{setTimeout(r,ms)})}

/**
 * @param {string} code 
 * @param {string} data 
 * @returns {Promise<Record<string,any>>} 
 */
async function op(code, data) {
  const result = await fetch("/op/"+code,{
    body: data,
    method: "POST",
    headers: [
      ["Content-Type", "application/json"]
    ],
  });
  return result.json()
}

async function compileAndRun() {
  const compileResult = await op('compile', sourceCode.value);
  if (compileResult["success"])
    window.open(`/terminal.html?id=${compileResult["hash"]}&name=${encodeURIComponent(compileResult.programName)}`);
  else
    alert("Compilation failed; check and correct errors, then try again.");
}

async function connectProcess() {
  const hash = new URL(location.href).searchParams.get("id");
  sock = new WebSocket(`ws://${location.hostname}:${location.port}/op/run?id=${hash}`);
  const output = document.getElementById("terminal-output-text");
  sock.addEventListener("message", async e=>{
    //console.log(e.data);
    const txt = e.data;
    if (txt.startsWith('"--FATAL"')) {
      output.innerHTML += "<br><span class='error'><br>Runtime Errors from Python<br></span><br>"
      output.innerHTML += `<span class="error">${txt.replace('"--FATAL"',"")}</span><br>`;
    }
    else
      output.textContent += txt+"\n";
  });
  sock.addEventListener("close", e=>{
    document.getElementById("terminal-input").disabled = true;
    output.innerHTML += "<span style='color:green;'>Program Finished</span>"
  });
}

async function sendInput() {
  const inputEle = document.getElementById("terminal-input");
  sock.send(inputEle.value);
  inputEle.value = "";
}

async function editorNew(){
  sourceCode.value = "";
  updateCodePreview();
}

function pickFile(){
  return new Promise(resolve=>{
    /** @type {HTMLInputElement} */
    const fileChooser = document.createElement("input");
    fileChooser.type = "file";
    fileChooser.onchange = fce=>{
      const f = fileChooser.files[0];
      if (!f) return alert("Please pick a file.");
      const r = new FileReader();
      r.onload = e=>{
        let data = e.target.result;
        resolve(data);
      }
      r.readAsText(f);
    };
    fileChooser.click();
  });
}

async function editorOpen(){
  const source = await pickFile();
  sourceCode.value = source;
  updateCodePreview();
}

async function editorSave(){
  const compileResult = await op('compile', sourceCode.value);
  let saveName = "myprogram";
  if (compileResult.success && compileResult.programName)
    saveName = compileResult.programName;
  const filename = prompt("Program Title:", saveName);
  if (filename == null || filename == "") {
    if (filename == "") alert("Please enter a filename.");
    return;
  }
  const a = document.createElement("a");
  const data = new Blob([sourceCode.value],{type: "text/plain"});
  a.href = URL.createObjectURL(data);
  a.download = filename + ".z";
  a.click();
}

async function editorCompile(){
  const result = await op('compile', sourceCode.value);
  if (!result.success) return alert("Compilation failed; check and correct errors, then try again.");
  let saveName = "myprogram";
  if (result.success && result.programName)
    saveName = result.programName;
  const filename = prompt("Program Title:", saveName);
  if (filename == null || filename == "") {
    if (filename == "") alert("Please enter a filename.");
    return;
  }
  const a = document.createElement("a");
  const data = new Blob([result.output],{type: "text/plain"});
  a.href = URL.createObjectURL(data);
  a.download = filename + ".py";
  a.click();
}

let currentTokens = [];
let needToRecheckErrors = true;
let compileTimer = {
  value: 2,
  reset(){
    compileTimer.value = 2;
  },
  run(){
    if (compileTimer.value < 1) {
      if (needToRecheckErrors) { updateCodeErrors(); needToRecheckErrors = false}
      compileTimer.reset();
    }
    else
    compileTimer.value--;
  }
};
if (sourceCode !== null) setInterval(compileTimer.run, 100);

function findTokenIndex(t){
  let i = 0;
  for (let tok of currentTokens) {
    if (tok.position == t.position && tok.line == t.line)
      return i;
    i++;
  }
  return null;
}

window.addEventListener("keydown",e=>{if(e.key == "Tab"){e.preventDefault();return false;}});
if (sourceCode !== null) sourceCode.addEventListener("keydown", function(e){
  if (e.key === "Tab") {
    const initialPos = this.selectionStart+2;
    this.value = this.value.slice(0,this.selectionStart)+"  "+this.value.slice(this.selectionEnd);
    this.setSelectionRange(initialPos,initialPos);
    e.preventDefault();
    updateCodePreview();
    return false;
  }
});

async function updateCodeErrors(){
  //console.log("2");
  const compileResult = await op('compile', sourceCode.value);
  for (let i=0; i<currentTokens.length; i++) {
    const ele = document.getElementById(`tok${i}`);
    const eot = document.getElementById("editor-end-of-tokens-error");
    ele.title = "";
    ele.classList.remove("error");
    eot.className = "";
    eot.title = "";
  }
  if (!compileResult["success"]) {
    for (let e of compileResult["errors"]) {
      const eot = document.getElementById("editor-end-of-tokens-error");
      if (e.type == "parser" || e.type == "undefined") {
        const index = findTokenIndex(e.token);
        const ele = document.getElementById(`tok${index}`);
        ele.classList.add("error");
        ele.title += e.message+"\n";
      }
      else {
        eot.title = e.message;
        eot.className = "error";
      }
    }
  }
}

function htmlEntities(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function updateCodePreview() {
  pageStorage.setItem("userCode", sourceCode.value);
  needToRecheckErrors = true;
  compileTimer.reset();
  sourceCode.style.width = "";
  sourceCode.style.height = "";
  const width = sourceCode.scrollWidth + ((sourceCode.scrollWidth > sourceMain.clientWidth) ? 15 : 0);
  const height = sourceCode.scrollHeight + ((sourceCode.scrollHeight > sourceMain.clientHeight) ? 15 : 0);
  sourceCode.style.width = `${width}px`;
  sourceCode.style.height = `${height}px`;
  currentTokens = lex(sourceCode.value);
  let text = sourceCode.value;
  for (let i=currentTokens.length-1; i>=0; i--) {
    text = text.slice(0,currentTokens[i].absolutePos)+
      `<span id="tok${i}" class="theme-editor-${currentTokens[i].type}">`+
      htmlEntities(currentTokens[i].value)+`</span>`+
      text.slice(currentTokens[i].absolutePos+currentTokens[i].value.length);
  }
  text = "<span>"+text.replace(/\n/g, " </span><span>")+"</span><span id='editor-end-of-tokens-error'></span>";
  sourceHighlight.innerHTML = text;
}

/** @param {HTMLBodyElement} b */
function highlightCodeElementChildren(b){
  const eles = b.getElementsByTagName("code");
  for (let e of eles) {
    let text = e.textContent;
    if (text[0] === '\n') text = text.slice(1);
    const toks = lex(text);
    toks.reverse();
    for (let t of toks) {
      text = text.slice(0,t.absolutePos)+
        `<span class="theme-editor-${t.type}">`+
        htmlEntities(t.value)+`</span>`+
        text.slice(t.absolutePos+t.value.length);
    }
    text = "<span>"+text.replace(/\n/g, " </span><span>")+"</span>";
    e.innerHTML = text;
  }
}

const progName = document.getElementById("terminal-prog-name");
if (progName !== null) {
  const name = new URL(location.href).searchParams.get("name");
  progName.textContent = decodeURIComponent(name)+".z";
}

const termIn = document.getElementById("terminal-input");
if (termIn !== null) {
  termIn.addEventListener("keydown", e=>{
    if (e.key === "Enter") sendInput();
  })
}
