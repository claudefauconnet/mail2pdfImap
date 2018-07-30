//var MailParser = require("./myMailParser/mail-parser.js").MailParser;
var MailParser = require("mailparser").MailParser;
var mailparser = new MailParser({defaultCharset:"utf8"});

var fs=require('fs');


mailparser.on('data', function(data) {
    if (data.type === 'text') {
    console.log(data.html);
}
});

mailparser.on('headers', function(headers) {
   var xx= headers;
});

var i=0;
fs.createReadStream("D:\\test\\r"+(i++)+'.txt').pipe(mailparser);



// send the email source to the parser
//mailparser.write(email);
//mailparser.end();