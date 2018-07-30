var Imap = require('imap');
var inspect = require('util').inspect;
var async = require('async');
var simpleParser = require('mailparser').simpleParser;
var fs = require('fs');
var path = require('path');
var mailPdfGenerator = require('./mailPdfGenerator');
var zipdir = require('zip-dir');
var socket = require('../routes/socket.js');
var chardet = require('chardet');
var iconv = require('iconv-lite');

var host = 'imap.atd-quartmonde.org';
var port = 993;

/*var host = 'imap.sfr.fr';
var port = 993;*/

var pdfArchiveDir = "./pdfs";

var skippedFolders = ["Autres utilisateurs", "Dossiers partagés"];

var imapMailExtractor = {
    deleteDirAfterZip: true,
    archiveMaxSize: 1000 * 1000 * 50,//50MO

    getImapConn: function (mailAdress, password) {
        var imap = new Imap({
            user: mailAdress,
            password: password,
            host: host,
            port: port,
            connTimeout: 30000,
            authTimeout: 30000,
            tls: true
        });
        return imap;


    },


    getFolderHierarchy: function (mailAdress, password, rootFolder, callback) {

        var imap = imapMailExtractor.getImapConn(mailAdress, password);
        var leafFolder = rootFolder;
        if (rootFolder) {
            var p = rootFolder.lastIndexOf("/");
            if (p > -1)
                leafFolder = rootFolder.substring(p + 1);
        }
        imap.once('ready', function () {
            imap.getBoxes([], function (err, result) {
                if (err)
                    return callback(err)

                var tree = [];
                var id = 1000;

                function recurse(idParent, object, ancestors) {


                    for (var key in object) {
                        if (!rootFolder || rootFolder.indexOf(key) > -1 || ancestors.indexOf(leafFolder) > -1) {

                            id += 1;
                            var ancestors2 = ancestors.slice(0);
                            ancestors2.push(key)
                            tree.push({parent: idParent, id: id, text: key, ancestors: ancestors2});

                            recurse(id, object[key].children, ancestors2)
                        }
                    }


                }

                recurse("#", result, []);


                return callback(null, tree);
            });


        }).once('error', function (err) {
            console.log('Fetch error: ' + err.message);
            callback(err.message);
        }).once('end', function () {
            imap.end();
        });
        imap.connect();
    }
    ,
    getFolderMessages: function (mailAdress, password, folder, callback) {
        var messages = [];
        messages.folderSize = 0;
        var i = 0;
        var imap = imapMailExtractor.getImapConn(mailAdress, password);
        imap.once('ready', function () {
            imap.openBox(folder, true, function (err, box) {
                if (err) {
                    console.log(err);
                    return callback(err)
                }
                var f = imap.seq.fetch('1:*', {
                    bodies: '',
                    struct: true
                });

                f.on('message', function (msg, seqno) {
                    var message = {};
                    var encoding = [];
                    //  message.seqno = seqno;
                    msg.on('body', function (stream, info) {
                        messages.folderSize += info.size;

                        var buffer = '';
                        stream.on('data', function (chunk) {
                           // !!!!!!!!!!!determination de l'encodage du buffer pour le transformer en UTF8
                                encoding = chardet.detectAll(chunk);
                         //   console.log(encoding[0].name+" "+encoding[1].name);
                                if (encoding.length > 0 && encoding[0].name != 'UTF-8') {

                                    var str = iconv.decode(chunk, encoding[0].name);

                                    buffer += str;
                                }
                                else {
                                    buffer += chunk.toString('utf8');
                                }
                            }
                        );
                        stream.once('end', function () {

                            //!!!!!!!!!!! on remplace   charset=windows-1252; lencodage du corps du texte par utf8 sinon mailparser ne fonctionne pas correctement : node_modules/mail-parser.js line 674

                        buffer = buffer.replace(/charset=[a-zA-Z-0-9\-]*/g, "charset=utf8")


                              //   console.log("w"+i+"  "+encoding[0].name+" "+encoding[1].name);
                         //    fs.writeFileSync("D:\\test\\w" + (i++) + '.txt', encoding[0].name + " " + encoding[1].name + "\n" + buffer)

                            messages.push(buffer);


                        });
                    });
                    msg.once('attributes', function (attrs) {
                        //  message.attributes =attrs;
                    });
                    msg.once('end', function () {


                    });
                });
                f.once('error', function (err) {
                    console.log('Fetch error: ' + err.message);
                    callback(err.message);
                });
                f.once('end', function () {
                    callback(null, messages)
                    imap.end();
                });
            });


        })
        imap.connect();

    },


    generateFolderHierarchyMessages: function (mailAdress, password, rootFolder, withAttachments, callback) {
        var archivePath = null;
        var leafFolder = rootFolder;
        var archiveSize = 0;
        if (rootFolder) {
            var p = rootFolder.lastIndexOf("/");
            if (p > -1)
                leafFolder = rootFolder.substring(p + 1);
        }
        var message = " start extracting messages from " + leafFolder;
        socket.message(message);
        var totalMails = 0;


        //set pdf files root path
        var pdfArchiveRootPath = pdfArchiveDir + "/" + mailAdress + "_" + Math.round(Math.random() * 100000);
        pdfArchiveRootPath = path.resolve(pdfArchiveRootPath);
        if (!fs.existsSync(pdfArchiveRootPath)) {
            fs.mkdirSync(pdfArchiveRootPath);
        }


        imapMailExtractor.getFolderHierarchy(mailAdress, password, rootFolder, function (err, folders) {
            var output = [];


            async.eachSeries(folders, function (folder, callbackEachFolder) {

                if (skippedFolders.indexOf(folder.text) > -1) {
                    return callbackEachFolder();
                }

                var folderMessages = {folder: folder.text, ancestors: folder.ancestors, messages: [], root: leafFolder}


                var box = "";
                for (var i = 0; i < folder.ancestors.length; i++) {
                    if (i > 0)
                        box += "/";
                    box += folder.ancestors[i];
                }
                imapMailExtractor.getFolderMessages(mailAdress, password, box, function (err, messages) {


                    if (err) {
                        console.log(err);
                        return;// callbackEachFolder();
                    }
                    archiveSize += messages.folderSize;
                    if (archiveSize > imapMailExtractor.archiveMaxSize) {
                        var text = "Operation aborted : maximum size of archive reached :" + Math.round(archiveSize / 1000000) + "/" + Math.round(imapMailExtractor.archiveMaxSize / 1000000) + "MO"
                        socket.message(text);
                        imapMailExtractor.deleteFolderRecursive(pdfArchiveRootPath);
                        return callbackEachFolder(text);


                    }

                    else {
                        if (box.indexOf(leafFolder) < 0) {
                            return callbackEachFolder()
                        }
                        var message = " Processing " + messages.length + " from server in folder " + box;
                        socket.message(message);
                        var xx = 1;
                        if (messages.length == 0)
                            return callbackEachFolder();
                        folderMessages.messages = messages;
                        imapMailExtractor.createFolderPdfs(pdfArchiveRootPath, folderMessages, withAttachments, function (err, result) {
                            if (err) {
                                return callbackEachFolder(err)
                            }
                            totalMails += result;
                            return callbackEachFolder();
                        });
                        // output.push(folderMessages);

                    }


                })


            }, function (err) {// endEach
                if (err) {
                    console.log(err);
                    return callback(err)
                }
                return callback(null, {
                    text: "Total mails Processed" + totalMails + " preparing zip download, size:" + Math.round(archiveSize / 1000000) + "MO",
                    pdfArchiveRootPath: pdfArchiveRootPath
                });
            })
        })
    },
    createFolderPdfs: function (pdfArchiveRootPath, folderMessages, withAttachments, callback) {

        /* var date = new Date();
         var senderDateDir = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + (date.getDate());

         pdfDirPath += "/" + senderDateDir;
         var dir = path.resolve(pdfDirPath);
         if (!fs.existsSync(dir)) {
             fs.mkdirSync(dir);
         }*/

        var start = folderMessages.ancestors.indexOf(folderMessages.root)
        if (start < 0)
            return callback(null, 0);

        for (var i = start; i < folderMessages.ancestors.length; i++) {

            pdfArchiveRootPath += "/" + folderMessages.ancestors[i];
            var dir = path.resolve(pdfArchiveRootPath)
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir);
            }

        }

        //end set pdf files path

        async.eachSeries(folderMessages.messages, function (rawMessage, callbackEachMail) {
            simpleParser(rawMessage, function (err, mail) {
               // console.log(mail.subject);
                if (err) {
                    console.log(err);
                    return callbackEachMail(err);
                }

                mailPdfGenerator.createMailPdf(pdfArchiveRootPath, mail, withAttachments, function (err, result) {
                    if (err) {
                        console.log(err);
                        //   return callbackEachMail(err);
                    }
                    return callbackEachMail(null);
                });


            })


        }, function (err) {
            if (err) {
                console.log(err);
                return callback(err);
            }
            return callback(null, folderMessages.messages.length);
        });


    },
    downloadArchive: function (mailAdress, pdfArchiveRootPath, response) {

        socket.message("download pdfMailArchive-" + pdfArchiveRootPath + " STARTED");

        var dir = path.resolve(pdfArchiveRootPath);

        zipdir(dir, function (err, buffer) {
            if (err)
                return callback(err);

            response.setHeader('Content-type', 'application/zip');
            response.setHeader("Content-Disposition", "attachment;filename=pdfMailArchive-" + pdfArchiveRootPath + ".zip");
            response.send(buffer);
            socket.message("download pdfMailArchive-" + pdfArchiveRootPath + " DONE");
            if (imapMailExtractor.deleteDirAfterZip)
                imapMailExtractor.deleteFolderRecursive(dir);

        });

    }


    , deleteFolderRecursive: function (path) {
        if (fs.existsSync(path)) {
            fs.readdirSync(path).forEach(function (file, index) {
                var curPath = path + "/" + file;
                if (fs.lstatSync(curPath).isDirectory()) { // recurse
                    imapMailExtractor.deleteFolderRecursive(curPath);
                } else { // delete file
                    fs.unlinkSync(curPath);
                }
            });
            try {
                fs.rmdirSync(path);
            }
            catch (e) {
                console.log(e);
            }
        }
    }
}


module.exports = imapMailExtractor;


if (false) {
    //   imapMailExtractor.getFolderMessages(options.user, options.password, "Autres utilisateurs/administration.cijw", function (err, result) {
    imapMailExtractor.getFolderMessages(options.user, options.password, "Dossiers partagés/ecritheque", function (err, result) {

    })


}
if (false) {
    imapMailExtractor.generateFolderHierarchyMessages(options.user, options.password, "testMail2Pdf", function (err, result) {

    })


}

if (false) {


    imapMailExtractor.getFolderMessages(options.user, options.password, "ecritheque@atd-quartmonde.org", function (err, result) {

    })
}
