const fs=require('node:fs'),Module=require('node:module'),path=require('node:path');
const target=path.resolve(process.argv[2]);let s=fs.readFileSync(target,'utf8').replaceAll('http://127.0.0.1:8127',process.env.BROADCAST_TEST_URL||'http://127.0.0.1:61013');
const m=new Module(target,module);m.filename=target;m.paths=Module._nodeModulePaths(path.dirname(target));m._compile(s,target);
