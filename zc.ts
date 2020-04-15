import { zedCompiler } from "./zed.ts";
window.onload = async()=>{
    await zedCompiler({
        src: Deno.args[0],
        dst: Deno.args[0].replace(".z",".py")
    });
}
