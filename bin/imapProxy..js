var Imap = require('imap'),
    inspect = require('util').inspect;

var imap = new Imap({
    user: 'claude.fauconnet@neuf.fr',
    password: '964999',
    host: 'imap.sfr.fr',
    port: 993,
    tls: true
});

var imap = new Imap({
    user: 'claude.fauconnet@atd-quartmonde.org',
    password: 'fc6kDgD8',
    host: 'imap.atd-quartmonde.org',
    port: 993,
    tls: true
});
//fc6kDgD8
function openInbox(cb) {
  /*  imap.getBoxes([],function(err, result){
        var xx=result;
    })
    return;*/
    imap.openBox('INBOX', true, cb);
}
imap.once('ready', function() {
    openInbox(function(err, box) {
        if (err) throw err;
        var f = imap.seq.fetch('1:3', {
            bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)',
            struct: true
        });
        f.on('message', function(msg, seqno) {
            console.log('Message #%d', seqno);
            var prefix = '(#' + seqno + ') ';
            msg.on('body', function(stream, info) {
                var buffer = '';
                stream.on('data', function(chunk) {
                    buffer += chunk.toString('utf8');
                });
                stream.once('end', function() {
                    console.log(prefix + 'Parsed header: %s', inspect(Imap.parseHeader(buffer)));
                });
            });
            msg.once('attributes', function(attrs) {
                console.log(prefix + 'Attributes: %s', inspect(attrs, false, 8));
            });
            msg.once('end', function() {
                console.log(prefix + 'Finished');
            });
        });
        f.once('error', function(err) {
            console.log('Fetch error: ' + err);
        });
        f.once('end', function() {
            console.log('Done fetching all messages!');
            imap.end();
        });
    });
});

imap.once('error', function(err) {
    console.log(err);
});

imap.once('end', function() {
    console.log('Connection ended');
});





function getFolders(username, callback) {

    var folders = [];
    if (Connection[username]) {

        Connection[username].once('ready', function() {

            Connection[username].getBoxes(function (err, boxes) {


                if (err) {

                    // TODO : parse some error here

                } else {

                    folders = imapNestedFolders(boxes);

                }

                return callback(err, folders);
            });
        });

    } else {

        return framework.httpError(500, self);
    }
}

imap.connect();