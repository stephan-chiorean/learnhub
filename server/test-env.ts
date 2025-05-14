console.log('Database Configuration:');
console.log('POSTGRES_USER:', process.env.POSTGRES_USER);
console.log('POSTGRES_HOST:', process.env.POSTGRES_HOST);
console.log('POSTGRES_DB:', process.env.POSTGRES_DB);
console.log('POSTGRES_PORT:', process.env.POSTGRES_PORT);
// Don't log the password for security reasons
console.log('POSTGRES_PASSWORD is set:', !!process.env.POSTGRES_PASSWORD); 