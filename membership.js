var request = require( 'request' ),
	crypto = require( 'crypto' ),
	config = require( __dirname + '/config.json' );

var Membership = {
	validate: function ( tag, device, callback ) {
		var response = {
			active: false,
			valid: false
		}
		id = Membership.hashCard( tag );
		var url = config.api_url + '/api/permission/' + device  + '/' + id + '?api_key=' + config.api_key;
		request( url, function( err, res, body ) {
			if ( res.statusCode == 200 ) {
				var data = JSON.parse( body );
				callback( {
					valid: true,
					name: data.name
				} );
			} else {
				callback( {
					valid: false
				} );
			}
		} )
	},
	hashCard: function ( id ) {
		var md5 = crypto.createHash( 'md5' );
		md5.update( config['secret'] );
		md5.update( id.toLowerCase() );
		return md5.digest( 'hex' );
	}
};

module.exports = Membership;
