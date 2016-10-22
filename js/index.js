
var bitcore = require('bitcore-lib');

var showqr = function(type) {
	var addr = $('#result-address-'+type).val();
	var qrtext = 'bitcoin:'+addr;
	$('#qr-image').qrcode(qrtext+'?label='+encodeURIComponent('Custom P2SH address generated by https://goo.gl/HHEKDj'));
	$('#qr-text').html('<a href="'+qrtext+'">'+qrtext+'</a>');
	$('#modal-qr .modal-title').text('QR code for '+type);
	$('#modal-qr').modal();
};

var getInput = function() {
	var input = $('#input').val();
	// Strings after "//" or "#" should be ignored.
	input = input.replace(/\/\/.*/g, '');
	input = input.replace(/#.*/g, '');
	// Strings betwee "/*" and "*/" should be ignored.
	input = input.replace(/\/\*[\s\S]*?\*\//mg, '');
	return input.trim();
};

var rerun = function() {
	// Initialize.
	$('#result-text').val('');
	$('#result-text-error').hide();
	$('#result-hex').val('');
	$('#result-error').hide();
	$('#result-steps tbody *').remove();
	// Read input.
	var input = getInput();
	// Pass input to the interpreter.
	var chunks = input.split(/\s+/);
	try {
		var script = bitcore.Script.fromString(chunks.join(' '));
	} catch(e) {
		$('#result-text-error').show();
		return;
	}
	$('#result-text').val(script.toString());
	$('#result-hex').val('0x'+script.toHex());
	$('#result-url').val(location.href.split(/[?#]/)[0]+'?input='+encodeURIComponent(script.toString()));
	var scriptHash = bitcore.crypto.Hash.sha256ripemd160(script.toBuffer());
	$('#result-address-mainnet').val(bitcore.Address.fromScriptHash(scriptHash, bitcore.Networks.mainnet));
	$('#result-address-testnet').val(bitcore.Address.fromScriptHash(scriptHash, bitcore.Networks.testnet));
	var interpreter = new bitcore.Script.Interpreter();
	interpreter.set({script: script});
	var err = '';
	var result = true;
	for(; interpreter.pc<interpreter.script.chunks.length;) {
		result = interpreter.step();
		var stack = interpreter.stack.map(function(item) {return item.toString('hex');}).reverse().join('<br/>');
		var executed = (new bitcore.Script()).set({chunks: interpreter.script.chunks.slice(interpreter.pc-1, interpreter.pc)}).toString();
		var remaining = (new bitcore.Script()).set({chunks: interpreter.script.chunks.slice(interpreter.pc)}).toString();
		$('#result-steps tbody').append('<tr><td>' + [interpreter.pc, stack, executed, remaining].join('</td><td style="max-width:100px;overflow-x:scroll;">') + '</td></tr>');
		if(!result) break;
	}
	if(!result) {
		err += 'Script ended with error.';
	} else {
		if(interpreter.stack.length == 0) {
			result = false;
			err += 'The resulting stack is empty.';
		} else {
			var ret = interpreter.stack.pop();
			if(!bitcore.Script.Interpreter.castToBool(ret)) {
				result = false;
				err += 'The resulting top stack item is FALSE.';
			}
		}
	}
	if(!result) {
		$('#result-error').text(err);
		$('#result-error').show();
	}
	$('#result').removeClass('label-success');
	$('#result').removeClass('label-danger');
	$('#result').addClass(result ? 'label-success' : 'label-danger');
	$('#result').text('Result: ' + (result ? 'OK' : 'NG'));
}

var parseQuery = function() {
	var query = {};
	var tmp = location.search.substring(1).split('&');
	for(var data in tmp) {
		var t = tmp[data].split('=', 2);
		query[t[0]] = decodeURIComponent(t[1]);
	}
	return query;
}

var scriptTemplates = {
	empty: {
		title: 'Empty',
		description: 'Empty script.',
		script: [''],
	},
	p2pkh: {
		title: 'P2PKH',
		description: 'Pay-to-PubKey-Hash (P2PKH / P2PH) script.',
		script: [
			'# We use the following address to spend: https://blockchain.info/address/1AenoFbeG61b2B8G7Xv7vBeWYLgt1FfnAg',
			'',
			'##############################',
			'# scriptSig: <sig> <pubKey>',
			'##############################',
			'# <sig>',
			'OP_PUSHDATA1 71 0x30440220206fea7b21dbda9db2227c2d028d4e014c02fa1f29775eccea41fe70aeedb5aa022047e8e8d2b7983baa84a48f85ea55edfdbc5aae7001d46e2e6657a8d86c0c60d601',
			'# <pubKey>',
			'OP_PUSHDATA1 33 0x033ca9b849063327597b13fa4da8c98053302118ffa4d194090d636ba22906d657',
			'',
			'##############################',
			'# scriptPubkey (checks if the hash of a given pubkey matches the address, and checks the signature validity)',
			'##############################',
			'OP_DUP OP_HASH160',
			'# <pubkeyHash>',
			'20 0x69dec09e9b32ffd447c80d413d58f0413e99208e',
			'OP_EQUALVERIFY OP_CHECKSIG',
		],
	},
	p2pubkey: {
		title: 'P2PubKey',
		description: 'Pay-to-PubKey script (absolate).',
		script: ['<sig>\n<pubKey> OP_CHECKSIG'],
	},
	p2sh: {
		title: 'P2SH',
		description: 'Pay-to-Script-Hash (P2SH) script.',
		script: ['<arg1> <arg2>... <serializedScript>\nOP_HASH160 <scriptHash> OP_EQUAL'],
	},
	op_return: {
		title: 'OP_RETURN',
		description: 'Unspendable output with any user-defined commitments.',
		script: [
			'# scriptSig is empty.',
			'# scriptPubkey: OP_RETURN <data1> <data2>...',
			'OP_RETURN 4 0x12345678',
		],
	},
	anyone_can_spend: {
		title: 'Anyone-Can-Spend',
		description: 'Outputs spendable by anyone.',
		script: ['OP_TRUE'],
	},
	puzzle: {
		title: 'Transaction Puzzle',
		description: 'Tranasction puzzle describled at Bitcoin wiki.',
		script: [
			'# scriptSig (push block header of the genesis block)',
			'OP_PUSHDATA1 80 0x0100000000000000000000000000000000000000000000000000000000000000000000003ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4a29ab5f49ffff001d1dac2b7c',
			'',
			'# scriptPubkey (take double-SHA256 hash and checks if the hash matches the genesis hash.)',
			'OP_HASH256 32 0x6fe28c0ab6f1b372c1a6a246ae63f74f931e8365e15a089c68d6190000000000 OP_EQUAL',
		],
	},
};

var selectTemplate = function(title) {
	$('#input').val(scriptTemplates[title].script.join('\n'));
	$('#input').attr('rows', scriptTemplates[title].script.length+5);
	rerun();
}

var initTemplateSelector = function() {
	// Initialize template selector.
	for(var i in scriptTemplates) {
		var st = scriptTemplates[i];
		$('#template-selector').append('<button type="button" title="'+st.description+'" class="btn btn-default" onclick="selectTemplate(\''+i+'\')">'+st.title+'</button>');
	}
}

$(document).ready(function() {
	$('[readonly]').css('background-color', '#ddd');
	$('[readonly]').on('click', function() {this.select()});
	var query = parseQuery();
	if(query.input) {
		$('#input').val(query.input);
	} else {
		selectTemplate('puzzle');
	}
	initTemplateSelector();
	rerun();
});

