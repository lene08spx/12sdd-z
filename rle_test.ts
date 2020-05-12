// potentially useful for bundling website...
const fileData = await Deno.readFile("CascadiaMono.ttf");
const byteMap: Record<string,number> = {};
let currentByte = -1;
//const out = new Deno.Buffer();
for (let i = 0; i < fileData.length; i+=2) {
  const n = fileData.subarray(i,i+2).join(",");
  n in byteMap
    ? byteMap[n]++
    : byteMap[n]=1;
}
console.log(Object.keys(byteMap).length);
let n1 = 0;
for (let [k,v] of Object.entries(byteMap)) {
  if (v > 2) n1++;
}
console.log(n1)