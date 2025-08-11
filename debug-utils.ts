#!/usr/bin/env bun

/**
 * Debug script to test our FinTS utility functions
 */

import { 
	isTransactionSuccess, 
	isDecoupledTanPending, 
	FINTS_RESPONSE_CODES 
} from './src/client/utils/fintsUtils';

console.log('🧪 Testing FinTS Utility Functions');
console.log('==================================\n');

// Test the bank response from request 3 that should indicate completion
const request3BankAnswers = [
	{
		code: 3060,
		text: "Bitte beachten Sie die enthaltenen Warnungen/Hinweise."
	},
	{
		code: 20,
		text: "Ihr Gerät wurde erfolgreich als vertrauenswürdig gespeichert."
	},
	{
		code: 3050,
		text: "UPD nicht mehr aktuell, aktuelle Version enthalten."
	},
	{
		code: 3920,
		text: "Zugelassene Zwei-Schritt-Verfahren für den Benutzer."
	},
	{
		code: 20,
		text: "Der Auftrag wurde ausgeführt."
	}
];

console.log('📋 Testing bank response from request 3:');
console.log('Response codes:', request3BankAnswers.map(a => `${a.code}: ${a.text}`));
console.log();

console.log('🔍 Utility function results:');
console.log('isTransactionSuccess():', isTransactionSuccess(request3BankAnswers));
console.log('isDecoupledTanPending():', isDecoupledTanPending(request3BankAnswers));
console.log();

console.log('📊 Constants:');
console.log('SUCCESS code:', FINTS_RESPONSE_CODES.SUCCESS);
console.log('SUCCESS_PENDING code:', FINTS_RESPONSE_CODES.SUCCESS_PENDING);
console.log('DECOUPLED_TAN_AUTHENTICATION_PENDING code:', FINTS_RESPONSE_CODES.DECOUPLED_TAN_AUTHENTICATION_PENDING);
console.log();

console.log('✅ Expected behavior:');
console.log('- isTransactionSuccess() should return TRUE (has code 20)');
console.log('- isDecoupledTanPending() should return FALSE (no 3956 pending code)');
console.log('- Result: Should complete polling (completion=true, pending=false)');
