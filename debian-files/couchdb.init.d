#!/bin/sh -e

# Licensed under the Apache License, Version 2.0 (the "License"); you may not
# use this file except in compliance with the License. You may obtain a copy of
# the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
# WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
# License for the specific language governing permissions and limitations under
# the License.

### BEGIN INIT INFO
# Provides:          couchdb
# Required-Start:    $local_fs $remote_fs
# Required-Stop:     $local_fs $remote_fs
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Short-Description: Apache CouchDB init script
# Description:       Apache CouchDB init script for the database server.
### END INIT INFO

SCRIPT_OK=0
SCRIPT_ERROR=1

DESCRIPTION="database server"
NAME=couchdb
SCRIPT_NAME=`basename $0`
COUCHDB=/usr/local/bin/couchdb
CONFIGURATION_FILE=/usr/local/etc/default/couchdb
RUN_DIR=/usr/local/var/run/couchdb
LSB_LIBRARY=/lib/lsb/init-functions

if test ! -x $COUCHDB; then
    exit $SCRIPT_ERROR
fi

if test -r $CONFIGURATION_FILE; then
    . $CONFIGURATION_FILE
fi

start_couchdb () {
    # Start Apache CouchDB as a background process.

    mkdir -p "$RUN_DIR"
    if test -n "$COUCHDB_USER"; then
        chown $COUCHDB_USER "$RUN_DIR"
    fi
    command="$COUCHDB -b"
    if test -n "$COUCHDB_STDOUT_FILE"; then
        command="$command -o $COUCHDB_STDOUT_FILE"
    fi
    if test -n "$COUCHDB_STDERR_FILE"; then
        command="$command -e $COUCHDB_STDERR_FILE"
    fi
    if test -n "$COUCHDB_RESPAWN_TIMEOUT"; then
        command="$command -r $COUCHDB_RESPAWN_TIMEOUT"
    fi
    echo "$command"
    eval sudo $command
}

stop_couchdb () {
    # Stop the running Apache CouchDB process.
    $COUCHDB -d
}

display_status () {
    # Display the status of the running Apache CouchDB process.

    $COUCHDB -s
}

parse_script_option_list () {
    # Parse arguments passed to the script and take appropriate action.

    case "$1" in
        start)
            start_couchdb
            ;;
        stop)
            stop_couchdb
            ;;
        restart)
            stop_couchdb
            start_couchdb
            ;;
        status)
            display_status
            ;;
        *)
            cat << EOF >&2
Usage: $SCRIPT_NAME {start|stop|restart|status}
EOF
            exit $SCRIPT_ERROR
            ;;
    esac
}

parse_script_option_list $@
