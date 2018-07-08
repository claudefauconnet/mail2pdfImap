var imapController = (function () {
    var self = {};
self.currentState="";
    self.loadTreeHierarchy = function () {


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


                })
            },
            error: function (err) {
                console.log(err);
                self.currentState="";
                $("#messageDiv").html("ERROR "+err);
            }
        })


    }

self.getJsTreeSelectedNodes=function(){
    var selectedData = [];
    var selectedIndexes;
    selectedIndexes = $("#jstreeDiv").jstree("get_selected", true);
    jQuery.each(selectedIndexes, function (index, value) {
        selectedData.push(selectedIndexes[index]);
    });
    return selectedData;
}
    self.generateFolderPdfArchive = function (withAttachments) {


        var selectedNodes=self.getJsTreeSelectedNodes();
        if(selectedNodes.length==0){
            return alert("select a root folder first");

        }
        $("#messageDiv2").html("");
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
                if (data.length == 0) {
                    return;

                }
                self.currentState="ARCHIVE_DONE";
                $("#messageDiv2").append("<B>"+data.result+"</B>");
                $("#downloadArchiveButton").css("visibility","visible");


            },
            error: function (err) {
                console.log(err);
                self.currentState="";
                $("#messageDiv").html("ERROR : "+err);
            }
        })


    }


    self.downloadArchive = function (url, payload) {
        var selectedNodes=self.getJsTreeSelectedNodes();
        if(selectedNodes.length==0){
            return alert("select a  folder first and process it first");

        }
        var folder=selectedNodes[0].text
        var payload = {
            downloadArchive: 1,
            rootFolder: folder,
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