/**
 * TEST IMPORT - Check if stripe-simple.js can be imported
 */

console.log('🔍 TEST: Testing import of stripe-simple.js');

try {
  const { getStatus } = await import('./stripe-simple.js');
  console.log('✅ TEST: Import successful');
  console.log('✅ TEST: getStatus function:', typeof getStatus);
  
  const status = getStatus();
  console.log('✅ TEST: Status result:', status);
} catch (error) {
  console.error('❌ TEST: Import failed:', error.message);
  console.error('❌ TEST: Error details:', error);
}
