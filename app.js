var crypto = require( 'crypto' ),
	net = require( 'net' ),
	rl = require( 'readline' ),
	https = require( 'https' ),
	request = require( 'request' )
	config = require( __dirname + '/config.json' )
	Membership = require( __dirname + '/membership.js' );

var client_id = 1;
var contactless_id = '21222324';
var cacheExpiry = 30;

var cache = [];

// Server
// =================================
// This function sets up the server

var server = net.createServer( function ( client ) {
	client.rl = rl.createInterface( client, client );
	client.rl.client = client;
	client.name = client_id++;
	console.log( '#' + client.name +'	Connected (' + client.remoteAddress + ')' );
	client.on( 'end', clientDisconnectionEvent );
	client.on( 'timeout', clientTimeoutEvent );
	client.rl.on( 'line', clientData );
	client.on( 'error', errorEvent );
	client.setTimeout( 2500 );
} );

server.listen( config.port, function () {
	console.log( 'Server started' );
} );

// Client Disconnected Event Handler
// =================================
// This function handles client disconnection events by logging them to the console

function clientDisconnectionEvent() {
	console.log( '#' + this.name + '	Disconnected' );
}

// Client Timeout Event Handler
// ============================
// This function handles client timeout events by logging them to the console and kicking the client

function clientTimeoutEvent() {
	console.log( '#' + this.name + '	Timed Out' );
	this.end();
}

// Client Data Event Handler
// =========================
// This function handles incoming client data and processing

function clientData( buffer ) {
	var client = this.client;
	var tag = buffer.toString().trim();
	if ( tag.length > 50 ) {
		console.log( 'Data too long' );
		declineClient( client );
		return;
	}

	if ( client.device == undefined ) {
		if ( config.devices[tag] == undefined ) {
			console.log( '#' + client.name + '	Invalid device ID' );
			declineClient( client, '' );
			return;
		}

		client.device = tag;
		console.log( '	Device: ' + client.device );
		return;
	}

	if ( tag == '' ) {
		console.log( '#' + client.name + '	Card Number Not Sent' );
		declineClient( client );
		return;
	}

	if ( tag == contactless_id ) {
		console.log( '#' + client.name + '	Contactless Card Use Blocked (21222324)' );
		declineClient( client );
		return;
	}

	console.log( '#' + client.name + '	Tag: ' + tag );

	Membership.validate( tag, function( res ) {
		if ( res.active ) {
			if ( checkPermission( res.permission, client.device ) ) {
				validateClient( client, res, tag );
			} else {
				declineClient( client, res, tag )
			}
		} else {
			declineClient( client, res, tag )
		}
	} );
}

// Validate Client
// ===============
// This function responds to a valid client request and handles notification and logging

function validateClient( client, data, tag ) {
	var device = config.devices[ client.device ];

	// Tell client
	client.write( '1' );
	client.end();

	// Send notification
	if ( checkCache( tag, device ) ) {
		if ( data.name && device.message.success ) {
			var msg = data.name + device.message.success;
			postToDiscourse( msg );
		} else if ( device.message.success ) {
			var msg = 'Someone' + device.message.success;
			postToDiscourse( msg );
		}
	}

	// Log to console
	console.log( '#' + client.name + '	Validated (' + data.name + ')' );

	// Store to cache
	storeInCache( tag, device );
}

// Decline Client
// ==============
// This function responds to a invalid client request and handles notification and logging

function declineClient( client, data, tag ) {
	var device = config.devices[ client.device ];

	// Tell client
	client.write( '0' );
	client.end();

	// Send notification
	if ( checkCache( tag, 'decline' ) ) {
		if ( data !== undefined && tag !== undefined ) {
			if ( data.success != false && data.active == null ) {
				var msg = 'An inactive members card was at the space: ' + data.name + ' (' + tag + ')';
				postToDiscourse( msg );
			} else {
				if ( data.name && device.message.failed ) {
					var msg = data.name + device.message.failed;
					postToDiscourse( msg );
				} else if ( device.message.failed ) {
					var msg = tag + ' ' + device.message.failed;
					postToDiscourse( msg );
				}
			}
		}
	}

	// Log to console
	console.log( '#' + client.name + '	Declined' );

	// Store to cache
	storeInCache( tag, 'decline' );
}

// Error Event Handler
// ===================
// This function handles connection errors by logging them and closing the connection

function errorEvent( error ) {
	if ( error.errno == 'ECONNRESET' ) {
		console.log( '#' + this.name + '	Error: Connection reset by client (hard disconnect)' );
	} else {
		console.log( '#' + this.name + '	Error: ', error );
	}
	this.end();
}

// Check Cache
// ==============
// This function checks if an item is in the cache or not

function checkCache( tag, device ) {
	for ( i in cache ) {
		if ( cache[i].id === tag && cache[i].device === device ) {
			var expires = new Date();
			expires.setSeconds( expires.getSeconds() + cacheExpiry );
			cache[i].expires = expires;
			return false;
		}
	}
	return true;
}

// Store In Cache
// ==============
// This function adds new items to the cache and marks the expiry date

function storeInCache( tag, device ) {
	var expires = new Date();
	expires.setSeconds( expires.getSeconds() + cacheExpiry );
	var item = {
		id: tag,
		device: device,
		expires: expires
	};
	cache.push( item );
}

// Clear Cache
// ===========
// This function periodically checks the cache and removes old entries

function clearCache() {
	for ( i in cache ) {
		if ( cache[i].expires <= new Date() ) {
			cache.splice( i, 1 );
		}
	}
}
setInterval( clearCache, 1000 );

// Check Permision
// ===============
// This function checks the user level has permission.
function checkPermission( level, permission ) {
	if ( level == 50 ) return true;
	if ( config.devices[ permission ].permission.indexOf( level ) != -1 ) return true;
	return false;
}

// Post to discourse
// =================
// This funciton sends a message to discourse
function postToDiscourse( msg ) {
	request.post( {
		url: config.discourse.url,
		form: {
			raw: msg,
			topic_id: config.discourse.topic,
			api_username: config.discourse.api_username,
			api_key: config.discourse.api_key
		}
	} );
}
