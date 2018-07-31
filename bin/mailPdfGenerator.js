/*******************************************************************************
 * mailArchiver_ATD LICENSE************************
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2017 Claude Fauconnet claude.fauconnet@neuf.fr
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 ******************************************************************************/

var fs = require('fs')
var modulesDir = "";//'../../../../nodeJS/node_modules/'
var PDFDocument = require(modulesDir + 'pdfkit');
var path = require('path');
var common = require('./common.js');
var socket = require('../routes/socket.js');
var execSync = require('child_process').execSync;

var addMetaData = false;


var mailPdfGenerator = {
    pdfDir: "",//"pdfArchives",
    maxPdfSubjectLength: 33,
    addMetaData: true,
    attachmentMaxSize: 5000000,
    attachmentsExcluded:["logosignature.png","atd_slogan.png"]
    ,

    createMailPdf: function (pdfDirPath, mail, withAttachments, callback) {
        try {


            if (mail.html)
                mail.html = mailPdfGenerator.removeHtmlTags(mail.html);
            if (mail.text)
                mail.text = mailPdfGenerator.removeHtmlTags(mail.text);


            var mailTitle;
            if (mail.subject)
                mailTitle = mail.subject;
            else
                mailTitle = "mail_sans_sujet_" + Math.round(Math.random() * 1000000);
            var initialName=mailTitle;
            var pdfFileName = mailTitle;

            mailTitle = mailPdfGenerator.formatStringForArchive(mailTitle, mailPdfGenerator.maxPdfSubjectLength);
            mailTitle = mailPdfGenerator.removeMultipleReAndFwdInTitle(mailTitle);
            pdfFileName = common.dateToString(mail.date) + "-" + mailTitle + ".pdf";
            pdfFileName = mailPdfGenerator.processDuplicateMailTitles(pdfDirPath, pdfFileName);

            console.log(initialName+"\t"+pdfFileName)

            var attachments = [];
            if (withAttachments && mail.attachments) {
                for (var i = 0; i < mail.attachments.length > 0; i++) {
                    if (mail.attachments[i].filename) {
                        //  archiveProcessor.consoleToFile(mail.attachments[i].name)
                        //    var id = mail.attachments[i].contentId;

                        var attachmentName = mailPdfGenerator.processAttachment(mail.attachments[i], pdfDirPath, pdfFileName);
                        if (attachmentName)
                            attachments.push(attachmentName);//"<a href='attachments/"+attachmentName+"'>"+mail.attachments[i].filename + "</a>\n";
                    }
                }
            }


            var doc = new PDFDocument


            var pdfPath = path.resolve(pdfDirPath + "/" + pdfFileName);
            // console.log("--processing--"+pdfFileName);
            /* if (fs.existsSync(pdfPath))
                 fs.unlinkSync(pdfPath)*/
            doc.pipe(fs.createWriteStream(pdfPath));


            var fontSize = {
                title: 12,
                text: 10,
                small: 8
            }
            var textWidth = 500


            //metadata
            if (addMetaData) {
                if (mail.subject)
                    doc.info.Title = mail.subject;
                if (mail.from)
                    doc.info.Author = mail.from.text;
                if (mail.date)
                    doc.info.CreationDate = mail.date;


                //  doc.info.Keywords=""+mail.subject+","+mail.from.text+","+mail.to.text


            }


            doc.fontSize(fontSize.title)
            doc.text('MessageId : ', {width: textWidth, align: 'left'})
            doc.fontSize(fontSize.text)
            doc.text(mail.messageId, {width: textWidth, align: 'left'})
            // doc.text(mail.headers["Message-ID"], {width: textWidth, align: 'left'})


            doc.fontSize(fontSize.title)
            doc.text('From : ', {width: textWidth, align: 'left'})
            doc.fontSize(fontSize.text)
            if (mail.from)
                doc.text(mail.from.text, {width: textWidth, align: 'left'})

            doc.moveDown(0.5)
            doc.fontSize(fontSize.title)
            doc.text('To : ', {width: textWidth, align: 'left'})
            doc.fontSize(fontSize.text)
            if (mail.to)
                doc.text(mail.to.text, {width: textWidth, align: 'left'})


            doc.moveDown(0.5)
            doc.fontSize(fontSize.title)
            doc.text('replyTo : ', {width: textWidth, align: 'left'})
            doc.fontSize(fontSize.text)
            if (mail.replyTo)
                doc.text(mail.replyTo.text, {width: textWidth, align: 'left'})

            if (mail.cc && mail.cc.value.length > 0) {
                doc.moveDown(0.5)
                doc.fontSize(fontSize.title)
                //  doc.fontcolor("red")
                doc.text('cc : ', {width: textWidth, align: 'left'})
                doc.fontSize(fontSize.text)
                for (var i = 0; i < mail.cc.value.length; i++) {
                    doc.text(mail.cc.value[i].address + "\n", {width: textWidth, align: 'left'})
                }

            }
            if (mail.cci && mail.cci.value.length > 0) {
                doc.moveDown(0.5)
                doc.fontSize(fontSize.title)
                //  doc.fontcolor("red")
                doc.text('cci : ', {width: textWidth, align: 'left'})
                doc.fontSize(fontSize.text)
                for (var i = 0; i < mail.cci.value.length; i++) {
                    doc.text(mail.cci.value[i].address + "\n", {width: textWidth, align: 'left'})
                }

            }

            doc.moveDown(0.5)
            doc.fontSize(fontSize.title)
            doc.text('Date : ', {width: textWidth, align: 'left'})
            doc.fontSize(fontSize.text)
            doc.text(mail.date, {width: textWidth, align: 'left'})

            doc.moveDown(0.5)
            doc.fontSize(fontSize.title)
            doc.text('Subject : ', {width: textWidth, align: 'left'})
            doc.fontSize(fontSize.text)
            doc.text(mail.subject, {width: textWidth, align: 'left'})


            if (attachments.length > 0) {
                doc.fontSize(fontSize.title)
                doc.text('Attachments removed : ', {width: textWidth, align: 'left'})
                doc.moveDown(0.5)
                for (var i = 0; i < attachments.length; i++) {

                    doc.moveDown(0.5)
                    doc.underline(20, 0, 100, 20, 'blue')
                        .link(20, 0, 100, 20, './attachments/' + attachments[i])
                    //  doc.fontcolor("red")
                    doc.fontSize(fontSize.text)
                    if (attachments[i].substring)
                        doc.text(attachments[i].substring(attachments[i].indexOf("__" + 2)), {
                            width: textWidth,
                            align: 'left'
                        })
                }


            }
            /*  if (mail.references && mail.references.length > 0) {
                  doc.moveDown(0.5)
                  doc.fontSize(fontSize.title)
                  //  doc.fontcolor("red")
                  doc.text('References : ', {width: textWidth, align: 'left'})
                  doc.fontSize(fontSize.small)
                  for (var i = 0; i < mail.references.length; i++) {
                      doc.text(mail.references[i] + "\n", {width: textWidth, align: 'left'})
                  }

              }*/


            doc.moveDown(0.5)
            doc.fontSize(fontSize.title)
            doc.text('text : ', {width: textWidth, align: 'left'})
            doc.fontSize(fontSize.small)
            if (mail.text)
                doc.text(mail.text, {width: textWidth, align: 'left'})
            else if (mail.html)
                doc.text(mail.html, {width: textWidth, align: 'left'})
            else if (mail.textAsHtml)
                doc.text(mail.textAsHtml, {width: textWidth, align: 'left'})


            doc.end();
        //    mailPdfGenerator.convertToNewestPDFversion(pdfPath);
            // archiveProcessor.totalPdfSaved += 1
            return callback(null, {path: pdfDirPath, file: pdfFileName});
        }
        catch (e) {
            console.log(" ERROR , file " + pdfFileName + " skipped : " + e);
            return callback(e)
        }
    },
    formatStringForArchive: function (str, maxLength) {
        str = common.toAscii(common.truncate(str, maxLength));
        str = str.replace(/ /g, "_");
        str = common.replaceNonLetterOrNumberChars(str, "");
        str = str.replace(/_/g, "-");
        return str;
    },
    removeMultipleReAndFwdInTitle: function (str) {
        var re = /Re[-_:]/gi
        var fwd = /Fwd[-_:]/gi;
        var str0 = str;

        var reArray = str.match(re);
        if (reArray && reArray.length > 1) {
            //  str = "Re-" + reArray.length + "-" + str.replace(re, "");
            str = str.replace(re, "") + "-Re-" + reArray.length;
        }
        else if (reArray && reArray.length == 1) {// on met Re_ en fin
            str = str.replace(re, "") + "-Re"
        }
        var fwdArray = str0.match(fwd);
        if (fwdArray && fwdArray.length > 1) {

            str = str.replace(fwd, "") + "-Fwd-" + fwdArray.length;
        }
        else if (fwdArray && fwdArray.length == 1) {// on met Re_ en fin
            str = str.replace(fwd, "") + "-Fwd"
        }
        return str;
    }, removeHtmlTags: function (str) {
        str = str.replace(/<\/p>/gi, "\n");
        str = str.replace(/<BR>/gi, "\n");
        str = str.replace(/<[^>]*>/gi, "");

        //specific CF
        str = str.replace(/&nbsp;/gi, "");
        str = str.replace(/@import.*/gi, "");
        str = str.replace(/[™•]+.*/gm, "");

        str = str.replace(/[\r]+.*/gm, "");


        return str;
    }, processDuplicateMailTitles: function (pdfDirPath, pdfFileName) {
        var i = 0;
        var isDuplicate = false
        var prefix = ""
        do {
            isDuplicate = fs.existsSync(path.resolve(pdfDirPath + "/" + prefix + pdfFileName));
            if (isDuplicate) {
                i++;
                prefix = "" + i;
            }
            else {
                return pdfFileName.substring(0, pdfFileName.indexOf(".pdf")) + prefix + ".pdf";
            }

        } while (i < 100)
        return pdfFileName;

    },
    processAttachment: function (attachment, pdfDirPath, pdfFileName) {
        if (attachment.filename.indexOf(".asc") > -1) {// attachment of type signature ???
            return;
        }
        if(mailPdfGenerator.attachmentsExcluded.indexOf(attachment.filename)>-1)
            return;

        var attachmentsDir = path.resolve(pdfDirPath + "/attachments");
        if (!fs.existsSync(attachmentsDir)) {
            fs.mkdirSync(attachmentsDir);
        }
        var pdfPreffix = pdfFileName.substring(0, pdfFileName.lastIndexOf("."))
        /* var dir = path.resolve(attachmentsDir + "/" + pdfDir);
         if (!fs.existsSync(dir)) {
             fs.mkdirSync(dir);
         }*/
        var attachmentFileName = pdfPreffix + "__" + attachment.filename
        if (attachment.content.length > mailPdfGenerator.attachmentMaxSize) {
           socket.message("BBBBBBBBBBBBBBBBB-BigAttachment :"+(attachment.content.size/1000000)+"MO maximum " +(mailPdfGenerator.maxPdfSubjectLength/1000000)+"  "+ pdfDirPath + "/" + pdfFileName);
            var attachmentFileName = pdfPreffix + "BIG-FILE__" + "__" + attachment.filename;
            var file = path.resolve(attachmentsDir + "/" + attachmentFileName);
            fs.writeFileSync(file, "BigAttachment content removed, size : " + attachment.content.size);
        } else {
            var file = path.resolve(attachmentsDir + "/" + attachmentFileName);
            fs.writeFileSync(file, attachment.content);
        }
        return attachmentFileName;
    }
    ,
    convertToNewestPDFversion: function (inputFile) {
//https://www.npmjs.com/package/ghostscript-js
        //  gswin64.exe -sDEVICE=pdfwrite -dCompatibilityLevel=1.5 -dNOPAUSE -dQUIET -dBATCH -sOutputFile=D:\GitHub\mail2pdfImap\pdfs\claude.fauconnet@atd-quartmonde.org_23679\testMail2Pdf\technique\moteurDerecherche\test2.pdf D:\GitHub\mail2pdfImap\pdfs\claude.fauconnet@atd-quartmonde.org_23679\testMail2Pdf\technique\moteurDerecherche\test.pdf

      var ghostscriptExe="gs";
        if (path.sep == "\\")//windows
            ghostscriptExe="\"C:\\Program Files\\gs\\gs9.21\\bin\\gswin64.exe\""
        var outputFile=inputFile.substring(0,inputFile.length-1)
        var cmd = ghostscriptExe + " -sDEVICE=pdfwrite  -sPAPERSIZE=a4 -dCompatibilityLevel=1.5 -dNOPAUSE -dQUIET -dBATCH -sOutputFile="+outputFile+" "+ inputFile;

        console.log("EXECUTING " + cmd)
        execSync(cmd, function (err, stdout, stderr) {
            if (err) {
                socket.message(err);
                return;

            }
            try {
                fs.unlink(inputFile);
            }
            catch(e){
                socket.message(e);
            }
        });

    }


}


module.exports = mailPdfGenerator;


