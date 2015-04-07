# Installation notes.

CouchDB installed from source with SpiderMonkey [installed from
source](https://wiki.apache.org/couchdb/Installing_SpiderMonkey)

I had to add the libjs.so folder to /etc/ld.so.conf.d/spidermonkey.conf (see
`debian-files/spidermonkey.conf`)

Look at `debian-files/*.init.d` for autostart scripts. Copy these files into
`/etc/init.d/` and run `sudo update-rc.d <filename> defaults` to set up.
