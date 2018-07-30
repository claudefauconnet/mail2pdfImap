var imapController = (function () {
    var self = {};
self.currentState="";
self.currentFolder="";
    self.loadTreeHierarchy = function () {

        $("#waitImg").css("visibility", "visible")
        var payload = {
            getFolderHierarchy: 1,
         //   rootFolder: "testMail2Pdf",
            mailAdress: $("#mailInput").val(),
            password: $("#passwordInput").val()
        }

        $.ajax({
            type: "POST",
            url: "/imap",
            data: payload,
            dataType: "json",
            success: function (data, textStatus, jqXHR) {
                $("#waitImg").css("visibility", "hidden")
                if (data.length == 0) {
                    return;

                }
                self.currentState="OPENED";
                $("#messageDiv").html("Select a box to process");

                $('#jstreeDiv').jstree({
                    'core': {
                        'data': data
                    }
                }).on('loaded.jstree', function() {
                    $('#jstreeDiv').jstree('open_all');
                }).on('changed.jstree', function (e, data) {
                    var i, j, r = [];
                    var str = ""
                    for (i = 0; i < data.node.parents.length; i++) {

                        var parentNode = $('#jstreeDiv').jstree(true).get_node("" + data.node.parents[i]);
                        console.log(parentNode.text)
                    }

                    ;
                    $("#generateFolderPdfArchiveButton").css("visibility","visible");
                    $("#generateFolderPdfArchiveWithAttachmentButton").css("visibility","visible");
                    $("#messageDiv2").html("");
                    $("#messageDiv3").html("");
                    $("#messageDiv").html(data.node.text+ " selected");


                })
            },
            error: function (err) {
                $("#waitImg").css("visibility", "hidden")
                console.log(err);
                self.currentState="";
                $("#messageDiv").html("ERROR "+err.responseText);
            }
        })


    }

self.getJsTreeSelectedNodes=function(){
    var selectedData = [];
    var selectedIndexes;
    $("#messageDiv2").html("");
    $("#messageDiv3").html("");
    selectedIndexes = $("#jstreeDiv").jstree("get_selected", true);
    jQuery.each(selectedIndexes, function (index, value) {
        selectedData.push(selectedIndexes[index]);
    });
    self.currentFolder=selectedData[0].text;
    return selectedData;
}
    self.generateFolderPdfArchive = function (withAttachments) {


        var selectedNodes=self.getJsTreeSelectedNodes();
        if(selectedNodes.length==0){
            return alert("select a root folder first");

        }
        $("#messageDiv3").html("Processing...");
        $("#messageDiv2").html("");
        $("#waitImg").css("visibility", "visible")
        self.currentState="ARCHIVE_PROCESSING";
        var folder = selectedNodes[0];
        var folderPath="";
            for(var i=0;i<folder.original.ancestors.length;i++){
            if(i>0)
                folderPath+="/";
            folderPath+=folder.original.ancestors[i];
        }
        var payload = {
            generateFolderHierarchyMessages: 1,
            rootFolder: folderPath,
            mailAdress: $("#mailInput").val(),
            password: $("#passwordInput").val()

        }
        if(withAttachments)
            payload.withAttachments=true;

        $.ajax({
            type: "POST",
            url: "/imap",
            data: payload,
            dataType: "json",
            success: function (data, textStatus, jqXHR) {
                self.currentState="ARCHIVE_DONE";
                $("#waitImg").css("visibility", "hidden")
                $("#messageDiv3").html("<B>"+data.text+"</B>");
                $("#downloadArchiveButton").css("visibility","visible");
                if (data.length == 0) {
                    return;

                }setTimeout(function(){// time to effectivly write files on server (if zip is incomplete and delete dir fails ( not empty)
                    self.downloadArchive(data.pdfArchiveRootPath)
                },3000)


            },
            error: function (err) {
                $("#waitImg").css("visibility", "hidden")
                console.log(err);
                self.currentState="";
                $("#messageDiv").html("ERROR : "+err.responseText);
            }
        })


    }


    self.downloadArchive = function (pdfArchiveRootPath) {


        var payload = {
            downloadArchive: 1,
            pdfArchiveRootPath: pdfArchiveRootPath,
            mailAdress: $("#mailInput").val(),

        }
        // Build a form
        var form = $('<form></form>').attr('action', "/imap").attr('method', 'post');
        // Add the one key/value
        for (var key in payload) {
            form.append($("<input></input>").attr('type', 'hidden').attr('name', key).attr('value', payload[key]));
        }
        //send request
        form.appendTo('body').submit().remove();
    };


    return self;


})()