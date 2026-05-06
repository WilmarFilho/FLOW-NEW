const { NextResponse } = require('next/server');
try {
  const res = NextResponse.redirect('https://flow.nkwflow.com\r/home');
  console.log(res.headers.get('Location'));
} catch (e) {
  console.error('ERROR:', e.message);
}
