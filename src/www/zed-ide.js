///<reference lib="dom"/>

async function op(code="",data="") {
  const result = await fetch("/op/"+code,{
    body: data,
    method: "POST"
  });
  return result.text();
}

async function compileAndRun() {
  const result = await op('compile', document.getElementById('editor-input').value);
  console.log(result);
}
const x = window.open("");
