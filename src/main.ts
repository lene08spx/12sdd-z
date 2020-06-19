// Copyright (C) 2020 - Oliver Lenehan - GNU GPLv3.0

import { compileSource } from "./compiler/compile.ts";
//import { IDE } from "./ide.ts";
import { WebView } from "./deps.ts";

export const zedConfig = {
  name: "zed",
  version: "0.0.1",
  description: "A compiler for the Z Programming Language"
};

async function runPython(script: string) {
  const proc = Deno.run({
    cmd: ["python", "-c", script]/*,
    stderr: "piped", stdin: "inherit", stdout: "inherit"*/
  });
  await proc.status();
  Deno.close(proc.rid);
}

async function subCompile(srcFile: string) {
  //const outFilename = srcFile.replace(/\.z$/m, "") + ".py";
  //const result = await compileFile(srcFile);
  //console.log(`Compilation took ${result.time}ms.`);
  //await Deno.writeFile(outFilename, result.buffer.bytes());
  //return outFilename;
}

function subHelp() {
  console.log(zedConfig.name + " " + zedConfig.version + "\n" + zedConfig.description + "\n" );
  console.log("USAGE:");
  console.log("    zed compile <file>");
  console.log("    zed edit [file]");
  console.log("    zed help");
  console.log("    zed repl");
  console.log("    zed run <file>");
}

if (import.meta.main) {
  // handle zed 'run' subcommand
  if (
    Deno.args[0] === "run" &&
    Deno.args.length === 2
  ) {
    //const compileResult = compile(await Deno.readTextFile(Deno.args[1]));
    //console.log(compileResult);
    //const str = new TextDecoder().decode(compileResult.buffer.bytes());
    //console.log(str);
    //await runPython(str);
  }
  // handle zed 'edit' subcommand
  else if (
    Deno.args[0] === "edit"
  ) {
    const html = `
    <!DOCTYPE HTML>
    <html>
      <body>
        <script>
          document.body.innerHTML = window.navigator.userAgent;
        </script>
      </body>
    </html>`;
    const win = new WebView({
      title: "Local deno_webview example",
      url: `data:text/html,${encodeURIComponent(html)}`,
      width: 800,
      height: 600,
      resizable: true,

    });
    await win.run();

    //const ide = new IDE();
    //ide.start();
    //ide.open();
  }
  // handle zed 'compile' subcommand
  else if (
    Deno.args[0] === "compile" &&
    Deno.args.length === 2
  ) {
    const result = compileSource(await Deno.readTextFile(Deno.args[1]));
    if (result.success) {
      console.log(`Compilation took ${Math.trunc(result.timeMs)}ms.`);
      await Deno.writeTextFile(Deno.args[1].replace(/.z$/,'.py'), result.output);
    }
    else {
      console.log("Compile Failed");
      for (let e of result.errors)
        console.log(e.message);
    }
  }
  // default to zed 'help' subcommand
  else {
    subHelp();
  }
  // handle zed 'repl' subcommand
  //else if (
  //  cliFlags._[0] === "repl"
  //) {
  //
  //}
  /*
  if (Deno.args.length === 0) {
    printHelp();
  }
  else {
    if (Deno.args[0] === "run") {
      let filename = Deno.args[1];
      if (filename && filename.endsWith(".z")) {
        // compile source
        console.log("Compile", parsePath(filename).base);
        const compileResult = await zedCompile(filename);
        console.log(`Took ${compileResult.time}ms.`);
        // hold output in temp-file
        const tempPath = await Deno.makeTempFile({prefix:"zed-obj-"});
        const tempFile = await Deno.copy(compileResult.buffer, await Deno.create(tempPath));
        const proc = Deno.run({
          cmd: ["python", tempPath]
        });
        await proc.status();
        await Deno.remove(tempPath);
      } else {
        console.log("Nothing to run.");
      }
    }
    else {
      printHelp();
    }
  }*/
}
