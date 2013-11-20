
/**
 * Module dependencies.
 */

var express = require('express');
var privates = require('./private.js');
var http = require('http');
var path = require('path');
var passport = require('passport');
var flash = require('connect-flash');
var _ = require('underscore');
var nodemailer = require('nodemailer')
var LocalStrategy = require('passport-local').Strategy;
var nano = require('nano')('http://' + privates.db_user + ':' + privates.db_pass + '@' + privates.db_host + ':' + privates.db_port);
var db = nano.db.use('teaharmony');
var usersdb = nano.db.use('_users');

var app = express();

// all environments
app.set('env', process.env.ENV || 'development');
app.set('port', (process.env.PORT || (process.env.ENV == 'live' ? 80 : 3000))); // set port to specified port number, 80 if env is live, or 3000 otherwise
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser('your secret here'));
app.use(express.session());
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

/*
 * Site variables
 */

var site = {
    trades: {
        milk_kefir: "milk kefir grains",
        water_kefir: "water kefir grains",
        scoby: "a SCOBY",
        sourdough: "sourdough starter",
        any: "anything"
    },
    terms: {
        have: "is offering",
        want: "is looking for",
        any: "has or want",
        second: {
            have: "are offering",
            want: "are looking for",
            any: "have or want"
        }
    },
    ctx: function(req) {
        var ctx = _.clone(site.default_ctx);
        ctx.path = req.path;
        ctx.dir = site.dir;
        ctx.user = req.user || null;
        ctx.terms = site.terms;
        ctx.trades = site.trades;
        var messages= req.flash('message');
        ctx.messages = messages.length > 0 ? messages : null;
        return ctx;
    },
    default_ctx: {
    },
    url: "http://glacier.camlittle.com:3000",
    home_dir: '/matches',
    email_re: /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
    validEmail: function(email) {
        return site.email_re.test(email);
    },
    username_re: /^([a-zA-Z0-9]((_|-| )[a-zA-Z0-9])?)*$/,
    validUsername: function(name) {
        return (site.username_re.test(name) && (name.length <= 16) && (name.length >= 4));
    },
    validTrade: function(trade) {
        return _.contains(_.without(_.keys(site.trades), 'any'), trade);
    },
    dir: ""
}

/*
 * User authentication
 */
passport.serializeUser(function(user, done) {
    done(null, user.name);
});
passport.deserializeUser(function(name, done) {
    findByName(name, function(err, user) {
        if (err) {
            console.log(err);
        }
        done(err, user);
    });
});
function findByName(name, fn) {
    usersdb.get('org.couchdb.user:' + name, { name: name }, function(err, body) {
        if (!err) {
            return fn(null, body);
        } else {
            return fn(err, null);
        }
    });
}
passport.use(new LocalStrategy(
    function(name, password, done) {
        findByName(name, function(err, user) {
            if (err) {
                if (err.status_code == 404) {
                    return done(null, false, { message: 'That user doesn\'t exist.' });
                } else {
                    console.log(err);
                    return done(err.reason);
                }
            }
            if (!user) {
                return done(null, false, { message: 'No user found with that username.' });
            }
            var httpreq = http.request({
                port: 5984,
                path: '/_session',
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                },
                method: 'POST',
                auth: name + ':' + password // base64 encodes
            }, function(res) {
                res.setEncoding('utf8');
                res.on('data', function(chunk) {
                    if (res.statusCode == 200) {
                        return done(null, user, { message: 'Logged in.' }); // this message not sent
                    } else {
                        return done(null, false, { message: 'Wrong password.' });
                    }
                });
            });
            httpreq.on('error', function(e) {
                return done(null, false, { message: 'Error.' });
            });
            httpreq.end('name=' + name + '&password=' + password);
        });
    }
));

/*
 * Emailing
 */
var emailTransport = nodemailer.createTransport('SMTP', {
    service: 'Gmail',
    auth: {
        user: privates.email_user,
        pass: privates.email_pass
    }
});

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

/*
 * Pages
 */
/*app.get('/', function(req, res) {
    res.render('site');
});*/
app.get(site.dir + '/', function(req, res) {
    if (req.user) {
        res.redirect(site.home_dir);
    } else {
        res.render('index', site.ctx(req));
    }
});
app.get(site.dir + '/login', function(req, res) {
    if (req.user) {
        req.flash('message', 'Already logged in');
        res.redirect(site.dir + '/next');
    } else {
        var errors = req.flash('error');
        _.each(errors, function(error) {
            req.flash('message', error);
        });
        res.render('login', site.ctx(req));
    }
});
app.post(site.dir + '/login', passport.authenticate('local', {
    successRedirect: site.dir + '/next',
    failureRedirect: site.dir + '/login',
    failureFlash: true
}));
app.get(site.dir + '/next', function(req, res) {
    var next_page = _.last(req.flash('next_page'));
    if (next_page) {
        res.redirect(next_page);
    } else {
        res.redirect(site.home_dir);
    }
});
app.post(site.dir + '/register', function(req, res) {
    var user = req.body;
    user.name = user.username;
    user._id = "org.couchdb.user:" + user.name;
    user.type = 'user';
    user.roles = [];
    if (!user.hnypt) {
        if (!site.validEmail(user.email)) {
            req.flash('message', 'Invalid email given.');
            res.redirect(site.dir + 'back');
        } else {
            if (!site.validUsername(user.name)) {
                req.flash('message', 'Invalid username. Username may contain only letters, numbers, spaces, underscores, and dashes and must be between 4 and 16 characters long.');
                res.redirect(site.dir + 'back');
            } else {
                if (user.password.length < 6) {
                    req.flash('message', 'Please use at least 6 characters for your password.');
                    res.redirect(site.dir + 'back');
                } else {
                    usersdb.view('general', 'names', { keys: [user.name] }, function(err, body) {
                        if (!err) {
                            if (body.rows.length > 0) {
                                passport.authenticate('local', function(err, user, info) {
                                    if (err) {
                                        req.flash('message', 'Something went wrong: ' + err);
                                        return res.redirect(site.dir + '/');
                                    } else if (!user) {
                                        req.flash('message', 'The username ' + req.body.name + ' has been taken already.');
                                        res.redirect(site.dir + '/');
                                    } else {
                                        req.login(user, function(err) {
                                            if (err) {
                                                console.log(err);
                                                req.flash('message', 'Something went wrong: ' + err);
                                                return res.redirect(site.dir + '/');
                                            }
                                            req.flash('message', { type: 'success', content: 'You already have an account and have been logged in.' });
                                            res.redirect(site.home_dir);
                                        });
                                    }
                                })(req, res);
                            } else {
                                usersdb.insert(user, 'org.couchdb.user:' + user.name, function(err, body) {
                                    var fail = function(err, to) {
                                        console.log(err);
                                        req.flash('message', { type: 'danger', content: err });
                                        res.redirect(to);
                                    };
                                    if (!err) {
                                        var message = {
                                            to: user.email,
                                            subject: 'TeaHarmony registration',
                                            text: 'You\'ve created account at TeaHarmony!\n' +
                                                  'Your username is "' + user.name + '".' + '\n\n' +
                                                  'Sign in to view your matches today at ' + site.url + '/login.\n\n' +
                                                  'Thanks for joining!'
                                        };
                                        emailTransport.sendMail(message);
                                        if (body.error) {
                                            fail(body.error, body.error + body.description);
                                        } else {
                                            if (user.have && user.have != 'null') {
                                                db.insert({
                                                    user: user.name,
                                                    have: user.have,
                                                    date: new Date()
                                                }, function(err, body) {
                                                    console.log(err);
                                                    if (err) {
                                                        fail(err, '/list')
                                                    } else {
                                                        return;
                                                    }
                                                });
                                            }
                                            if (user.want && user.want != 'null') {
                                                db.insert({
                                                    user: user.name,
                                                    want: user.want,
                                                    date: new Date()
                                                }, function(err, body) {
                                                    if (err) {
                                                        fail(err, '/list')
                                                    } else {
                                                        return;
                                                    }
                                                });
                                            }
                                            req.login(user, function(err) {
                                                if (err) {
                                                    fail(err, '/list');
                                                }
                                            });
                                            passport.authenticate('local')(req, res, function(err) {
                                                req.flash('message', { type: 'success', content: 'Welcome to TeaHarmony!' });
                                                res.redirect(site.home_dir);
                                            });
                                        }
                                    } else {
                                        if (err.status_code == 409) {
                                        } else {
                                            fail(err.status_code + ": " + err.description, '/register');
                                        }
                                    }
                                });
                            }
                        } else {
                            req.flash('message', { type: 'danger', content: 'Something went wrong: ' + err });
                            res.redirect(site.dir + 'back');
                        }
                    });
                }
            }
        }
    } else {
        res.status(500);
        res.send('nope')
    }
});
app.get(site.dir + '/register', function(req, res) {
    if (req.user) {
        res.redirect(site.home_dir);
    } else {
        res.render('register', site.ctx(req));
    }
});
app.get(site.dir + '/logout', function(req, res) {
    req.logout();
    req.flash('message', { type: 'success', content: 'Logged out' });
    res.redirect(site.dir + '/');
});
app.get(site.dir + '/user', function(req, res) {
    if (req.user) {
        db.view('teaharmony', 'user_all', { keys: [req.user.name] }, function(err, body) {
            var ctx = site.ctx(req);
            if (!err) {
                var items = _.pluck(body.rows, 'value');
                items = _.sortBy(items, function(item) {
                    return item.date;
                }).reverse();
                ctx.items = items;
            } else {
                console.log(err);
                req.flash('message', { type: 'danger', content: 'Database failure: ' + err });
            }
            var next_page = _.last(req.flash('next_page'));
            if (next_page) {
                res.redirect(next_page);
            }
            res.render('user', ctx);
        });
    } else {
        req.flash('message', 'Please login to view this page.');
        req.flash('next_page', req.path);
        res.redirect(site.dir + '/login');
    }
});
app.post(site.dir + '/user', function(req, res) {
    if (req.user) {
        if (!site.validEmail(req.body.email)) {
            req.flash('message', 'Invalid email given.');
            res.redirect('back');
        } else {
            var new_user = _.clone(req.user);
            if (req.body.email && req.body.email != req.user.email) {
                new_user.email = req.body.email;
            }
            if (req.body.password) {
                new_user.password = req.body.password;
            }
            usersdb.bulk({"docs": [new_user]}, function(err, body) {
                if (!err) {
                    req.flash('message', { type: 'success', content: 'Successfully updated account.' });
                } else {
                    console.log(err);
                    req.flash('message', { type: 'danger', content: 'Something went wrong updating your account.' });
                }
                res.redirect(site.dir + '/user');
            });
        }
    } else {
        req.flash('message', 'Login to do that.');
        req.flash('next_page', req.path);
        res.redirect(site.dir + '/login');
    }
});
app.get(site.dir + '/delete/:_id', function(req, res) {
    if (req.user) {
        db.view('teaharmony', 'delete_user_check', { keys: [req.params._id] }, function(err, body) {
            var item = body.rows[0].value;
            if (!err && item) {
                if (item.user == req.user.name || _.contains(req.user.roles, 'admin')) {
                    db.bulk({"docs": [{ "_id": req.params._id, "_rev": item._rev, "_deleted": true}]}, function(err, body) {
                        if (!err) {
                            if (!body.error) {
                                req.flash('message', { type: 'success', content: 'Successfully deleted that.' });
                            } else {
                                req.flash('message', 'Couldn\'t delete that: ' + body.error);
                            }
                        } else {
                            console.log(err);
                            req.flash('message', { type: 'danger', content: 'Something went wrong deleting that.' });
                        }
                    });
                } else {
                    console.log(req.user.name + ' tried to delete ' + req.params._id);
                    req.flash('message', { type: 'danger', content: 'You don\'t own that, and can\'t delete it.' });
                    req.flash('next_page');
                }
            } else {
                console.log(err);
                req.flash('message', { type: 'danger', content: 'Something went wrong deleting that.' });
            }
        });
    } else {
        req.flash('message', 'Login to do that.');
        req.flash('next_page', '/user');
        res.redirect(site.dir + '/login');
    }
    res.redirect('back');
});
app.get(site.dir + '/email_reset/:_id', function(req, res) {
    console.log(req.params._id);
    if (req.user) {
        db.view('teaharmony', 'delete_user_check', { keys: [req.params._id] }, function(err, body) {
            console.log(body);
            var item = body.rows[0].value;
            console.log(item);
            if (!err && item) {
                if (item.user == req.user.name || _.contains(req.user.roles, 'admin')) {
                    item.messages = 0;
                    db.bulk({"docs": [item]}, function(err, body) {
                        console.log(err);
                        console.log(body);
                        if (!err) {
                            if (!body.error) {
                                req.flash('message', { type: 'success', content: 'Successfully deleted that.' });
                            } else {
                                req.flash('message', 'Couldn\'t delete that: ' + body.error);
                            }
                        } else {
                            console.log(err);
                            req.flash('message', { type: 'danger', content: 'Something went wrong deleting that.' });
                        }
                    });
                } else {
                    console.log(req.user.name + ' tried to update ' + req.params._id);
                    req.flash('message', { type: 'danger', content: 'You don\'t own that, and can\'t update it.' });
                }
            } else {
                console.log(err);
                req.flash('message', { type: 'danger', content: 'Something went wrong updating that.' });
            }
        });
    } else {
        req.flash('message', 'Login to do that.');
        req.flash('next_page', '/user');
        res.redirect(site.dir + '/login');
    }
    res.redirect('back');
});
app.get(site.dir + '/have', function(req, res) {
    if (req.user) {
        res.render('have', site.ctx(req));
    } else {
        req.flash('message', 'Please login to view this page.');
        req.flash('next_page', req.path);
        res.redirect(site.dir + '/login');
    }
});
app.post(site.dir + '/have', function(req, res) {
    if (req.user) {
        if (site.validTrade(req.body.have)) {
            db.insert({
                user: req.user.name,
                have: req.body.have,
                date: new Date()
            }, function(err, body) {
                if (err) {
                    console.log(err);
                    req.flash('message', { type: 'danger', content: 'Something went wrong: ' + err });
                    res.redirect(site.dir + '/have');
                } else {
                    req.flash('message', { type: 'success', content: 'Successfully posted request.' });
                    res.redirect(site.home_dir);
                }
            });
        } else {
            req.flash('message', 'Please select something you are offering.');
            res.redirect('back');
        }
    } else {
        req.flash('message', 'Login to do that.');
        req.flash('next_page', req.path);
        res.redirect(site.dir + '/login');
    }
});
app.get(site.dir + '/want', function(req, res) {
    if (req.user) {
        res.render('want', site.ctx(req));
    } else {
        req.flash('message', 'Please login to view this page.');
        req.flash('next_page', req.path);
        res.redirect(site.dir + '/login');
    }
});
app.post(site.dir + '/want', function(req, res) {
    if (req.user) {
        if (site.validTrade(req.body.want)) {
            db.view('teaharmony', 'user_want', { keys: [req.user.name] }, function(err, body) {
                if (!err) {
                    if (_.where(_.pluck(body.rows, 'value'), { what: req.body.want }) == 0) {
                        db.insert({
                            user: req.user.name,
                            want: req.body.want,
                            date: new Date()
                        }, function(err, body) {
                            if (err) {
                                console.log(err);
                                req.flash('message', { type: 'danger', content: 'Something went wrong: ' + err });
                                res.redirect(site.dir + '/want');
                            } else {
                                req.flash('message', { type: 'success', content: 'Successfully posted!' });
                                res.redirect(site.home_dir);
                            }
                        });
                    } else {
                        var text = '';
                        req.flash('message', 'You have already requested ' + site.trades[req.body.want] + '.');
                        res.redirect(site.home_dir);
                    }
                } else {
                    console.log(err);
                    req.flash('message', { type: 'danger', content: 'Database error: ' + err });
                    res.redirect(site.dir + '/want');
                }
            })
        } else {
            req.flash('message', 'Please select something you are looking for.');
            res.redirect('back');
        }
    } else {
        req.flash('message', 'Login to do that.');
        req.flash('next_page', req.path);
        res.redirect(site.dir + '/');
    }
});
app.get(site.dir + '/contact', function(req, res) {
    req.flash('message', 'That page doesn\'t exist.');
    res.redirect(site.dir + '/');
});
app.post(site.dir + '/contact', function(req, res) {
    if (req.user) {
        findByName(req.body.to_user, function(err, to_user) {
            if (!err) {
                var message_text =  'You\'ve recieved a message from ' +
                                    req.user.name + ' on TeaHarmony';
                if (req.body._id) {
                    // lookup in database.
                    db.view('teaharmony', 'by_id', { keys: [req.body._id] }, function(err, body) {
                        if (!err && body.rows.length > 0) {
                            message_text += ' about ' + site.trades[body.rows[0].value.what] +
                                            ' you ' + site.terms.second[body.rows[0].value.type];
                            console.log(req.body._id);
                            console.log(body.rows[0]);
                            var doc = {
                                "_id": req.body._id,
                                "_rev": body.rows[0].value._rev,
                                "messages": (body.rows[0].value.messages || 0) + 1,
                                "date": new Date(),

                                "user": body.rows[0].value.user
                            }
                            doc[body.rows[0].value.type] = body.rows[0].value.what;
                            console.log(doc);
                            db.bulk({"docs": [ doc ]}, function(err, body) {
                                console.log(body);
                                if (err) {
                                    console.log(err);
                                }
                            });
                            afterCheck();
                        }
                    });
                } else {
                    afterCheck();
                }
                function afterCheck() {
                    message_text += '.\n\n----------------\n\n' +
                                    req.body.message +
                                    '\n\n----------------\n\n' +
                                    'Respond to them at ' + req.user.email +
                                    ', or send them a message by going to ' +
                                    site.url + '/contact/' + req.user.name + '.'
                    var message = {
                        from: req.user.email,
                        to: to_user.email,
                        subject: 'TeaHarmony Message from ' + req.user.name,
                        text: message_text
                    };
                    console.log(message.text);
                    emailTransport.sendMail(message, function(mail_err, mail_res) {
                        if (mail_err) {
                            console.log(mail_err);
                            req.flash('message', {type: 'danger', content: 'Email failed to send: ' + mail_err });
                            res.redirect(site.dir + '/contact/' + req.body.to_user);
                        } else {
                            console.log("Sent an email to " + to_user.email)
                            req.flash('message', { type: 'success', content: 'Successfully emailed ' + to_user.name + '.' });
                            res.redirect(site.home_dir);
                        }
                    });
                }
            } else {
                console.log(err);
                req.flash('message', { type: 'danger', content: 'Something went wrong: ' + err });
                res.redirect(site.dir + '/contact/' + req.body.to_user);
            }
        });
    } else {
        req.flash('message', 'Please login to do that.');
        req.flash('next_page', req.path);
        res.redirect(site.dir + '/login');
    }
});
app.get(site.dir + '/contact/:user', function(req, res) {
    if (req.user) {
        findByName(req.params.user, function(err, to_user) {
            if (to_user) {
                var ctx = site.ctx(req);
                ctx.to_user = to_user.name;
                res.render('contact', ctx)
            } else {
                console.log(err);
                req.flash('message', { type: 'danger', content: 'Something went wrong: ' + err });
                res.redirect(site.dir + '/');
            }
        });
    } else {
        req.flash('message', 'Please login to view this page.');
        req.flash('next_page', req.path);
        res.redirect(site.dir + '/login');
    }
});
app.get(site.dir + '/contact/:user/:id', function(req, res) {
    if (req.user) {
        findByName(req.params.user, function(err, to_user) {
            if (to_user) {
                db.view('teaharmony', 'by_id', { keys: [req.params.id] }, function(db_err, body) {
                    if (!db_err) {
                        if (body.rows.length > 0) {
                            var ctx = site.ctx(req);
                            ctx.to_user = to_user.name;
                            ctx.about = body.rows[0];
                            res.render('contact', ctx)
                        }
                    } else {
                        console.log(db_err);
                        req.flash('message', { type: 'danger', content: 'Database failure: ' + db_err });
                    }
                });
            } else {
                console.log(err);
                req.flash('message', { type: 'danger', content: 'Something went wrong: ' + err });
                res.render('contact', ctx)
            }
        });
    } else {
        req.flash('message', 'Please login to view this page.');
        req.flash('next_page', req.path);
        return res.redirect(site.dir + '/login');
    }
});
app.get(site.dir + '/matches', function(req, res) {
    if (req.user) {
        db.view('teaharmony', 'user_all', { keys: [req.user.name] }, function(err, body) {
            var ctx = site.ctx(req);
            if (!err) {
                var me = _.map(body.rows, function(row) {
                    return { type: row.value.type, what: row.value.what };
                });
                db.view('teaharmony', 'matches', { keys: me }, function(err, body) {
                    if (!err) {
                        var items = _.pluck(body.rows, 'value');
                        items = _.reject(items, function(item) {
                            return item.user == req.user.name;
                        });
                        items = _.sortBy(items, function(item) {
                            return item.messages;
                        }).reverse();
                        ctx.items = items;
                        res.render('matches', ctx);
                    } else {
                        console.log(err);
                        req.flash('message', { type: 'danger', content: 'Database failure: ' + err });
                    }
                });
            } else {
                console.log(err);
                req.flash('message', { type: 'danger', content: 'Database failure: ' + err });
            }
        });
    } else {
        req.flash('message', 'Please login to view this page.');
        req.flash('next_page', req.path);
        res.redirect(site.dir + '/login');
    }
});
app.get(site.dir + '/people', function(req, res) {
    if (req.user) {
        if (_.contains(req.user.roles, 'admin')) {
            usersdb.view('general', 'name_email', function(err, body) {
                if (!err) {
                    var ctx = site.ctx(req);
                    ctx.people = _.pluck(body.rows, 'value');
                    res.render('people', ctx);
                } else {
                    console.log(err);
                    req.flash('message', { type: 'danger', content: 'Database failure: ' + err });
                }
            });
        } else {
            req.flash('message', 'You must be an administrator to view this page.');
            res.redirect(site.dir + '/');
        }
    } else {
        req.flash('message', 'Please login to view this page.');
        req.flash('next_page', req.path);
        res.redirect(site.dir + '/login');
    }
});
app.get(site.dir + '/list', function(req, res) {
    db.view('teaharmony', 'all', function(err, body) {
        var ctx = site.ctx(req);
        if (!err) {
            var items = _.pluck(body.rows, 'value');
            items = _.sortBy(items, function(item) {
                return item.date;
            }).reverse();
            ctx.items = items;
            ctx.type = req.params.what || 'any';
            ctx.trade = req.params.trade || 'any';
        } else {
            console.log(err);
            req.flash('message', { type: 'danger', content: 'Database failure: ' + err });
        }
        res.render('list', ctx);
    });
});
app.get(site.dir + '/list/:what', list_filter);
app.get(site.dir + '/list/:what/:trade', list_filter);
function list_filter(req, res) {
    if ((req.params.what == 'any' && req.params.trade == 'any') ||
         (req.params.what == 'any' && !req.params.trade)) {
        res.redirect(site.dir + '/list');
    } else {
        if (req.params.trade == 'any') {
            res.redirect(site.dir + '/list/' + req.params.what);
        } else {
            var ctx = site.ctx(req);
            var keys = (req.params.what == 'any') ? ['have', 'want'] : [req.params.what];
            db.view('teaharmony', 'all', { keys: keys }, function(err, body) {
                if (!err) {
                    var items = _.pluck(body.rows, 'value');
                    if (req.params.trade) {
                        items = _.reject(items, function(item) {
                            return item.what != req.params.trade;
                        });
                    }
                    items = _.sortBy(items, function(item) {
                        return item.date;
                    }).reverse();
                    ctx.items = items;
                    ctx.type = req.params.what || 'any';
                    ctx.trade = req.params.trade || 'any';
                } else {
                    console.log(err);
                    req.flash('message', { type: 'danger', content: 'Database failure: ' + err });
                }
                res.render('list', ctx);
            });
        }
    }
};
app.get(site.dir + '/help', function(req, res) {
    res.render('help', site.ctx(req));
});
app.get(site.dir + '/:topic', function(req, res) {
    if (site.validTrade(req.params.topic)) {
        res.render(req.params.topic, site.ctx(req));
    } else {
        res.status(404);
        res.render('404', site.ctx(req));
    }
});
app.use(function(req, res, next) {
    res.status(404);
    res.render('404', site.ctx(req));
});
app.use(function(err, req, res, next) {
    console.log(err);
    ctx = site.ctx(req);
    ctx.status = err.status || 500;
    res.status(ctx.status);
    ctx.err = err;
    res.render('500', ctx)
});

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
