#!/bin/sh

#
# chkconfig: 35 99 99
# description: Node.js /home/nodejs/sample/app.js
#

#USER="cameronlittle"

DAEMON="/home/cameronlittle/local/bin/node"
ROOT_DIR="/var/www/wwubrew.com"

SERVER="$ROOT_DIR/app.js"
LOG_FILE="/var/log/teaharmony.log"

LOCK_FILE="/var/run/teaharmony"

do_start() {
    if [ ! -f "$LOCK_FILE" ] ; then
        touch $LOG_FILE
        echo -n "Starting $SERVER: "
        $DAEMON $SERVER >> $LOG_FILE 2>> $LOG_FILE &
        RETVAL=$?
        echo
        [ $RETVAL -eq 0 ] && echo "success" && touch $LOCK_FILE
    else
        echo "$SERVER is locked."
        RETVAL=1
    fi
}
do_stop() {
    echo -n $"Stopping $SERVER: "
    pid=`ps -aefw | grep "$DAEMON $SERVER" | grep -v " grep " | awk '{print $2}'`
    kill -9 $pid > /dev/null 2>&1 && echo "success" || echo "failed"
    RETVAL=$?
    echo
    [ $RETVAL -eq 0 ] && rm -f $LOCK_FILE
}

case "$1" in
    start)
        do_start
        ;;
    stop)
        do_stop
        ;;
    restart)
        do_stop
        do_start
        ;;
    *)
        echo "Usage: $0 {start|stop|restart}"
        RETVAL=1
esac

exit $RETVAL
