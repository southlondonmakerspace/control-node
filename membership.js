var request = require( 'request' ),
	crypto = require( 'crypto' ),
	config = require( __dirname + '/config.json' );

var Membership = {
	validate: function ( id , callback ) {
		var response = {
			active: false,
			valid: false
		}
		id = Membership.hashCard( id );
		request( 'https://members.southlondonmakerspace.org/api/member?card_id_hash=' + id, function( err, res, body ) {
			var member = JSON.parse( body );
			if ( member.success != false ) {
				response.valid = true;
				response.name = member.name;
				response.permission = member.permission;
				if ( member.active )
					response.active = true;
			}
			callback( response );
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
