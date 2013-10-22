### Using

- [node.js](http://nodejs.org) - server
- [express]http://expressjs.com/) - web application framework
- [CouchDB](http://couchdb.apache.org) - database
- [Passport](http://passportjs.org) - authentication
- [Jade](http://jade-lang.com) - templating
- [nano](https://github.com/dscape/nano) - CouchDB <--> node.js
- [nodemailer](https://github.com/andris9/Nodemailer) - emailing
- [Bootstrap](http://getbootstrap.com) - frontend framework
- [Underscore.js](http://underscorejs.org) - javascript utilities


### What's going on

    node.js     <-->    nano        <-->     CouchDB
     ^                   ^
     |                   |
     v                   v
    express     <-->    passport
     ^
     |
     v
    jade
     ^
     |
     v
    Bootstrap
