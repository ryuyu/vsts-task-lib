var path = require('path');
var shell = require('shelljs');
var fs = require('fs');
var os = require('os');

var mdpath = path.join(__dirname, 'vsts-task-lib.md');
var jsonpath = path.join(__dirname, 'vsotask.json');
var libpath = path.join(__dirname, '..', 'lib');

//--------------------------------------------------------------
// Util
//--------------------------------------------------------------
var header = function(line) {
    console.log();
    console.log(' ===== ' + line +  ' ====');
    console.log();
}
var writeLine = function(line) {
    fs.appendFileSync(mdpath, (line || ' ') + os.EOL);
}

var apiData = require(jsonpath);

var getChild = function(curr, parts) {
    if (!curr || !curr.children) {
        return null;
    }

    var find = parts[0];
    //console.log('looking for: ' + find);
    var item = null;

    for (var i = 0; i < curr.children.length; i++) {
        var child = curr.children[i];
        var name = child.name.replace(/"/g, '')
        //console.log('eval:' + name + ' ? ' + find);
        if (name === find) {
            //console.log('found!');
            item = child;
            break;
        }        
    }

    parts.shift();
    if (item && parts.length > 0) {
        //console.log('found: ' + item.name);
        item = getChild(item, parts);
    }

    return item;
}

var cache = {};
var get = function(id) {
    if (cache.hasOwnProperty(id)) {
        return cache[id];
    }

    var parts = id.split('.');
    var item = getChild(apiData, parts);
    if (item) {
        cache[id] = item;    
    }
    else {
        console.error('Could not find: ' + id);
    }
    
    return item;
}

//--------------------------------------------------------------
// Generate api json
//--------------------------------------------------------------
header('Generating api json');

var tdpath = shell.which('typedoc');
if (!tdpath) {
    console.error('could not find typedoc.  install via npm globally');
}

shell.rm('-rf', jsonpath);
var c = shell.exec(tdpath + " --module commonjs --json \"" + jsonpath + "\" \"" + libpath + "\"");
if (c.code !== 0) {
    console.log('failed');
    process.exit(1);
}

//--------------------------------------------------------------
// Generate markdown
//--------------------------------------------------------------
shell.rm('-rf', mdpath);
var ds = require('./structure.json');

writeLine('# VSTS-TASK-LIB TYPESCRIPT API');
writeLine();
writeLine('## Importing');
writeLine('For now, the built vsts-task-lib (in _build) should be packaged with your task in a node_modules folder');
writeLine();
writeLine('The build generates a vsts-task-lib.d.ts file for use when compiling tasks');
writeLine('In the example below, it is in a folder named definitions above the tasks lib');
writeLine();
writeLine('```');
writeLine('/// <reference path="../definitions/vsts-task-lib.d.ts" />');
writeLine("import tl = require('vsts-task-lib/vsotask')");
writeLine('```');
writeLine();

var obj = function(o) {
    console.log(JSON.stringify(o, null, 2));
}

var writeFunction = function(name, item) {
    writeLine('<div id="' + name + '">');
    writeLine('### ' + name);

    var sig = item['signatures'];
    if (sig && sig.length > 0) {
        sig = sig[0];
    }

    // comments
    var comment = sig.comment;
    if (comment) {
        //console.log('comment ' + comment);
        if (comment.shortText) {
            writeLine(comment.shortText);
        }            
    }

    var sigLine = item.name + '(';

    if (sig.parameters) {
        for (var i = 0; i < sig.parameters.length; i++) {
            var param = sig.parameters[i];
            sigLine += param.name;

            if (param.flags.isOptional) {
                sigLine += '?';
            }

            sigLine += (':' + param.type.name);

            if (i < (sig.parameters.length - 1)) {
                sigLine += ', ';
            }
        }
    }

    sigLine += '):' + sig.type.name;

    writeLine('```javascript');
    writeLine(sigLine);
    writeLine('```');

}

for (var secName in ds) {
    writeLine();
    writeLine('## ' + secName);
    writeLine();

    var sec = ds[secName];
    if (sec.Summary) {
        writeLine(sec.Summary);
        writeLine();
    }

    if (sec.Sample) {
        try {
            var contents = fs.readFileSync(path.join(__dirname, sec.Sample));    
            writeLine("```javascript");
            if (!contents || contents.length == 0) {
                writeLine('No content');
            }
            writeLine(contents);
            writeLine("```");
        }
        catch(err) {
            console.error(err);
        }
    }

    var docs = sec.Document;
    docs.forEach(function(doc) {
        var item = get(doc);

        if (item) {
            switch (item.kindString) {
                case "Constructor":
                case "Method":
                case "Interface":
                case "Enumeration":
                case "Function":
                    writeFunction(doc, item);
                    break;

                default:
                    console.log('warning: skipping ' + doc);
            }             
        }
    })
}

console.log('Done');








