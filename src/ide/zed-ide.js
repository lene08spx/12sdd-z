// Copyright (C) 2020 - Oliver Lenehan - GNU GPLv3.0

//@ts-nocheck
///<reference lib="dom"/>

/** @type {HTMLTextAreaElement} */
const sourceCode = document.getElementById('editor-input');
const sourceHighlight = document.getElementById('editor-preview');
const sourceMain = document.getElementById('editor-main');

const $ = document.querySelector.bind(document);
let socket = null;

// Load the work which was last left off from again.
const pageStorage = window["localStorage"];
if (sourceMain !== null) {
  window.addEventListener("load",e=>{
    sourceCode.value = pageStorage.getItem("userCode");
    updateCodePreview();
  });
}

// if we are in the Terminal, set the program name
const progName = document.getElementById("terminal-prog-name");
if (progName !== null) {
  const name = new URL(location.href).searchParams.get("name");
  progName.textContent = decodeURIComponent(name)+".z";
}

// if we are in the Terminal, enable "Enter" key for sending input
const termIn = document.getElementById("terminal-input");
if (termIn !== null) {
  termIn.addEventListener("keydown", e=>{
    if (e.key === "Enter") sendInput();
  })
}

/** An object mapping a RegExp pattern to a TokenType. */
const zedTokenRules = {
  "keyword": /(?<keyword>\b(?:PROG|ENDPROG|DO|ENDDO|OUT|IN|IF|OTHERWISE|ENDIF|SWITCH|ENDSWITCH|FOR|FROM|TO|BY|ENDFOR|WHEN|ENDWHEN|REPEAT|UNTIL|ENDREPEAT)\b)/,
  "number": /(?<number>-?\b\d+(?:\.\d+)?\b)/,
  "operator": /(?<operator>\+|-|\*|\/|>=|<=|>|<|==|&&|\|\||!|:|\[|\]|=|%)/,
  "string": /(?<string>"[ !#-~]*")/,
  "variable": /(?<variable>\b[A-Z]\d+\b)/,
  "identifier": /(?<identifier>\b[A-Za-z_]+\b)/,
  "comment": /(?<comment>#.*)/,
  "other": /(?<other>[^\s]+)/,
};
/** The RegExp instance used to match all tokens relevant to Zed. */
const zedTokenPattern = new RegExp(Object.values(zedTokenRules).map(v=>v.source).join("|"), "g");
/** Generate a Token given the RegExp match list from zedTokenPattern, and the lineNumber. */
function tokenFromMatch(matchedTokens, lineNumber) {
  const [ tokType, tokValue ] = Object.entries(matchedTokens.groups??{}).filter(v=>v[1]!==undefined)[0];
  return { type: tokType, value: tokValue, line: lineNumber, position: matchedTokens.index ?? 0, absolutePos: 0, };
}
/** Given the source code as a string,
 *  perform lexical analysis
 *  and return a list of tokens.
 * Differing from lex.ts is the handling of comments,
 * we want to keep them for visual display. */
function lex(source) {
  const tokenList = [];
  const lines = source.split(/\r?\n/);
  for (let lineNo = 0; lineNo < lines.length; lineNo++) {
    const tokenMatches = lines[lineNo].matchAll(zedTokenPattern);
    for (let match of tokenMatches) {
      const token = tokenFromMatch(match, lineNo+1);
      token.absolutePos = lines.slice(0, lineNo).join('').length+token.position+lineNo;//+lineNo for newlines
      tokenList.push(token);
    }
  }
  return tokenList;
}

/** Asynchronus function to delay by the given milliseconds. */
function delay(ms){return new Promise(r=>{setTimeout(r,ms)})}

/**
 * @param {string} code OpCode
 * @param {string} data Payload String
 * @returns {Promise<Record<string,any>>} 
 * Run an Op on the editor web-server.
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

// compile and run the current source code.
async function compileAndRun() {
  const compileResult = await op('compile', sourceCode.value);
  if (compileResult["success"])
    // open terminal in new window/tab
    window.open(`/terminal.html?id=${compileResult["hash"]}&name=${encodeURIComponent(compileResult.programName)}`);
  else
    alert("Compilation failed; check and correct errors, then try again.");
}

// connect the terminal to the IDE to run the program
async function connectProcess() {
  // get the program ID
  const hash = new URL(location.href).searchParams.get("id");
  // connect to the IDE server
  sock = new WebSocket(`ws://${location.hostname}:${location.port}/op/run?id=${hash}`);
  const output = document.getElementById("terminal-output-text");
  // on program output
  sock.addEventListener("message", async e=>{
    const txt = e.data;
    // if the program has errors, it will crash and this block will run
    // the socket will also be closed by the IDE server
    if (txt.startsWith('\n\n\nFATAL')) {
      output.innerHTML += "<br><span class='error'><br>Runtime Errors from Python<br></span><br>"
      output.innerHTML += `<span class="error">${txt.replace('\n\n\nFATAL',"")}</span><br>`;
    }
    else
      // output to the terminal text area.
      output.textContent += txt+"\n";
  });
  // when the program is finished
  sock.addEventListener("close", e=>{
    document.getElementById("terminal-input").disabled = true;
    output.innerHTML += "<span style='color:green;'>Program Finished</span>"
  });
}

// send input from the terminal to the currently running program
async function sendInput() {
  const inputEle = document.getElementById("terminal-input");
  sock.send(inputEle.value);
  inputEle.value = "";
}

// the File->New operation
async function editorNew(){
  sourceCode.value = "";
  updateCodePreview();
}

// opens the FileOpen dialog for the user to select a file.
// Returns the file as a string of source code
function pickFile(){
  return new Promise(resolve=>{
    /** @type {HTMLInputElement} */
    const fileChooser = document.createElement("input");
    fileChooser.type = "file";
    fileChooser.accept = ".z";
    // this runs when the dialog opens, and a file has been chosen
    fileChooser.onchange = fce=>{
      const f = fileChooser.files[0];
      // if it fails, get the user to try again
      if (!f) return alert("Please pick a file.");
      // read the file.
      const r = new FileReader();
      r.onload = e=>{
        // return the file as a string
        let data = e.target.result;
        resolve(data);
      }
      // read the file as a string
      r.readAsText(f);
    };
    // auto open the dialog
    fileChooser.click();
  });
}

// open the file dialog, get the source, and update the editor with it
async function editorOpen(){
  const source = await pickFile();
  sourceCode.value = source;
  updateCodePreview();
}

// save the contents of the editor to file
async function editorSave(){
  // compile the current program
  const compileResult = await op('compile', sourceCode.value);
  let saveName = "myprogram";
  // set the program name to save under
  if (compileResult.programName)
    saveName = compileResult.programName;
  // prompt the user incase they want to change the name
  const filename = prompt("Program Title:", saveName);
  if (filename == null || filename == "") {
    if (filename == "") alert("Please enter a filename.");
    return;
  }
  // download the file automatically, with the name that was chosen
  const a = document.createElement("a");
  const data = new Blob([sourceCode.value],{type: "text/plain"});
  a.href = URL.createObjectURL(data);
  a.download = filename + ".z";
  a.click();
}

// compile the program to python, and allow the result to be downloaded
async function editorCompile(){
  const result = await op('compile', sourceCode.value);
  if (!result.success) return alert("Compilation failed; check and correct errors, then try again.");
  let saveName = "myprogram";
  if (result.success && result.programName)
    saveName = result.programName;
  // prompt for an alternative filename
  const filename = prompt("Program Title:", saveName);
  if (filename == null || filename == "") {
    if (filename == "") alert("Please enter a filename.");
    return;
  }
  // automatically download the file
  const a = document.createElement("a");
  const data = new Blob([result.output],{type: "text/plain"});
  a.href = URL.createObjectURL(data);
  a.download = filename + ".py";
  a.click();
}

// this bit here is used in the editor to
// automatically compile regularly and show errors in the source code
let currentTokens = [];
let compileTimer = {
  value: 2,
  needToRecheckErrors: true,
  reset(){
    compileTimer.value = 2;
    this.needToRecheckErrors = true;
  },
  run(){
    if (compileTimer.value < 1) {
      // if there is a need to update errors, do so.
      // this feature just saves performance so there isnt a need to update
      // errors overly-frequently
      if (compileTimer.needToRecheckErrors) {
        updateCodeErrors(); compileTimer.needToRecheckErrors = false
      }
      //compileTimer.reset();
    }
    else
    compileTimer.value--;
  }
};
// set a timer used for updating the source code with errors found
if (sourceCode !== null) setInterval(compileTimer.run, 100);

// get the index of the given token in the current list of tokens
// used for HTML ids
function findTokenIndex(t){
  let i = 0;
  // do a search until postion and line match up
  for (let tok of currentTokens) {
    if (tok.position == t.position && tok.line == t.line)
      return i;
    i++;
  }
  return null;
}

// allow "Tab" input in the editor to insert two spaces
window.addEventListener("keydown",e=>{if(e.key == "Tab"){e.preventDefault();return false;}});
if (sourceCode !== null) sourceCode.addEventListener("keydown", function(e){
  if (e.key === "Tab") {
    // this is a little bit of trickery
    // this will be the position after we insert the tab
    const initialPos = this.selectionStart+2;
    // we insert the tab
    this.value = this.value.slice(0,this.selectionStart)+"  "+this.value.slice(this.selectionEnd);
    // move back to where we were (now 2 ahead)
    this.setSelectionRange(initialPos,initialPos);
    // stop default tab from moving us away.
    e.preventDefault();
    // update the highlighting, errors, etc.
    updateCodePreview();
    return false;
  }
});

// update the source code overlay, to show any errors
async function updateCodeErrors(){
  //console.log("2");
  const compileResult = await op('compile', sourceCode.value);
  // go through and reset each token element (so there are no displayed errors initially)
  for (let i=0; i<currentTokens.length; i++) {
    // this is the actual token element on the document
    const ele = document.getElementById(`tok${i}`);
    // this is a hidden element used to show unexpected end of tokens errors
    const eot = document.getElementById("editor-end-of-tokens-error");
    ele.title = "";
    ele.classList.remove("error");
    // helper to ensure that we can click through the error.
    function passSelectionToCodeTextArea(e){
      const selection = window.getSelection();
      if (selection === null) return;
      const tokPos = currentTokens[i].absolutePos;
      const selectionStart = selection.anchorOffset;
      const selectionEnd = selection.focusOffset;
      if (selectionStart < selectionEnd)
        sourceCode.setSelectionRange(tokPos+selectionStart,tokPos+selectionEnd);
      else
        sourceCode.setSelectionRange(tokPos+selectionStart,tokPos+selectionEnd);
      sourceCode.focus();
    }
    ele.addEventListener("mousedown",passSelectionToCodeTextArea);
    ele.addEventListener("mouseup",passSelectionToCodeTextArea);
    eot.className = "";
    eot.title = "";
  }
  if (!compileResult["success"]) {
    // go through each error
    for (let e of compileResult["errors"]) {
      const eot = document.getElementById("editor-end-of-tokens-error");
      // if its an error on a token do this
      if (e.type == "parser" || e.type == "undefined") {
        // get the index of the error token
        const index = findTokenIndex(e.token);
        const ele = document.getElementById(`tok${index}`);
        // add the error class
        ele.classList.add("error");
        // add the errors associated to it
        ele.title += e.message+"\n";
      }
      // if its the unexpected end of the file, do this
      else {
        eot.title = e.message;
        eot.className = "error";
      }
    }
  }
}

// used to program output accidentally becoming valid HTML
function htmlEntities(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// update the highlighting of the code. happens on the oninput attribute on the HTML document
function updateCodePreview() {
  // store the current user code
  pageStorage.setItem("userCode", sourceCode.value);
  // reset the error timer, so we dont check errors while typing immediately
  compileTimer.reset();
  // hackery for scroll of both input and overlay to follow each other
  sourceCode.style.width = "";
  sourceCode.style.height = "";
  const width = sourceCode.scrollWidth + ((sourceCode.scrollWidth > sourceMain.clientWidth) ? 15 : 0);
  const height = sourceCode.scrollHeight + ((sourceCode.scrollHeight > sourceMain.clientHeight) ? 15 : 0);
  sourceCode.style.width = `${width}px`;
  sourceCode.style.height = `${height}px`;
  // get the tokens currently written in the editor
  currentTokens = lex(sourceCode.value);
  let text = sourceCode.value;
  // update the overlay (in reverse order) with the highlighted code
  for (let i=currentTokens.length-1; i>=0; i--) {
    // attach the front of the source code
    text = text.slice(0,currentTokens[i].absolutePos)+
      // before the highlighted token
      `<span id="tok${i}" class="theme-editor-${currentTokens[i].type}">`+
      // encoding the user input, so it comes out as expected
      htmlEntities(currentTokens[i].value)+`</span>`+
      // and append the already highlighted code
      text.slice(currentTokens[i].absolutePos+currentTokens[i].value.length);
  }
  // replace new-lines with spans so lines show up in the editor
  text = "<span>"+text.replace(/\n/g, " </span><span>")+"</span><span id='editor-end-of-tokens-error'></span>";
  // update the overlay for the user.
  sourceHighlight.innerHTML = text;
}

/** @param {HTMLBodyElement} b */
// used to highlight inline code examples in the documentation
function highlightCodeElementChildren(b){
  const eles = b.getElementsByTagName("code");
  // for each <code> element...
  for (let e of eles) {
    let text = e.textContent.trim();
    // lex it
    const toks = lex(text);
    toks.reverse();
    // highlight in reverse
    // same as zed-ide.js updateCodePreview
    for (let t of toks) {
      text = text.slice(0,t.absolutePos)+
        `<span class="theme-editor-${t.type}">`+
        htmlEntities(t.value)+`</span>`+
        text.slice(t.absolutePos+t.value.length);
    }
    text = "<span>"+text.replace(/\n/g, " </span><span>")+"</span>";
    // update element
    e.innerHTML = text;
  }
}
