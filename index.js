const fs = require("fs");
const client = require("@stmanager/client");
const readline = require("readline");

if(!fs.existsSync("log")){
    fs.mkdirSync("log")   
}

if(!fs.existsSync("log/panel.log")){
    fs.writeFileSync("log/panel.log", ""); 
}

function formatDate(format) {
    const date = new Date();
    const map = {
        m: date.getMinutes(),
        h: date.getHours(),
        s: date.getSeconds(),
        mm: date.getMonth() + 1,
        dd: date.getDate(),
        yy: date.getFullYear().toString().slice(-2),
        yyyy: date.getFullYear()
    }

    return format.replace(/m|h|s|mm|dd|aa|aaaa/gi, matched => map[matched])
}

const Requests = new Map();

client.on("startRequest", function (requestInfo) {
    Requests.set(requestInfo.request_key, {
        userAgent: requestInfo.headers.get("user-agent"),
        ip: requestInfo.ip
    })
});

client.on("endRequest", function(requestInfo){

    const request = Requests.get(requestInfo.request_key);
    const headers = {};
    for(const key of requestInfo.headers.keys()){
        headers[key] = requestInfo.headers.get(key);
    }

    fs.appendFileSync(
        "log/panel.log",
        JSON.stringify({
            date: formatDate("[dd/mm/yyyy h:m:s]"),
            userAgent: request.userAgent,
            ip: request.ip,
            bodySize: requestInfo.bodySize,
        }),
        "\n"
    );

    Requests.delete(requestInfo.request_key)
    delete request;
    delete headers;

});

client.addMenuItem("Logs", "fa-solid fa-file-lines", "tolls", "SECURITY", "/admin/logs");

async function readByLine(callback, maxLines, skipLines){
    const readable = fs.createReadStream("log/panel.log");
    const reader = readline.createInterface({ input: readable });
    let linesNum = 0;
    let countLine = 0;
    const line = await new Promise((resolve) => {
        reader.on('line', (line) => {
            linesNum++;
            if(linesNum <= skipLines){
                return;
            }
            countLine++;
            if(countLine === maxLines){
                callback(line);
                reader.close();
            }else{
                callback(line);
            }
        });
        reader.on('close', () => {
            resolve();
        });
    });
    if(!readable.closed)
        readable.close();
}

client.addPage("ADMIN", "/admin/logs", function(request, response){
    if(!request.query.limit) request.query.limit = 10;
    if(!request.query.skip) request.query.skip = 0;

    response.write(`<table class='table'>`);
    response.write(`<thead><tr><td>#</td><td>IP</td><td>User Agent</td><td>Tamanho da resposta</td></tr></thead>`);
    response.write("<tbody>");
    let lineNumber = 0;
    readByLine((line) => {
        if(line !== ""){
            lineNumber++
            const jsonData = JSON.parse(line);
            response.write([
                `<tr><td>${lineNumber}</td>`,
                `<td>${response.escapeHtml(jsonData.ip)}</td>`,
                `<td>${response.escapeHtml(jsonData.userAgent)}</td>`,
                `<td>${response.escapeHtml(jsonData.bodySize)}</td>`,
            ].join(""))
        }
    }, request.query.limit, request.query.skip);

    if(lineNumber === 0){
        response.write("<tr><td colspan=3>Nenhuma linha disponivel</td></tr>");
    }
    response.write("</tbody></table>");
    response.end();
})
