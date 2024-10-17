const express = require('express');
const oracledb = require('oracledb');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Database connection details
const dbConfig = {
  user: 'SYS',
  password: 'N0raD3mr#1', // Replace with your actual password
  connectString: '(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=NIOGEMS-RDS)(PORT=1521))(CONNECT_DATA=(SERVICE_NAME=NIOGEMS)))',
  privilege: oracledb.SYSDBA
};

// Function to check if a table exists
async function checkTableExists(connection, tableName) {
  const result = await connection.execute(
    `SELECT COUNT(*) FROM ALL_TABLES WHERE TABLE_NAME = :tableName`,
    { tableName: tableName.toUpperCase() }
  );
  return result.rows[0][0] > 0;
}

// Function to check if a column exists in a specific table
async function checkColumnExists(connection, tableName, columnName) {
  const result = await connection.execute(
    `SELECT COUNT(*) FROM ALL_TAB_COLUMNS WHERE TABLE_NAME = :tableName AND COLUMN_NAME = :columnName`,
    { tableName: tableName.toUpperCase(), columnName: columnName.toUpperCase() }
  );
  return result.rows[0][0] > 0;
}

// User login endpoint
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  let connection;

  try {
    connection = await oracledb.getConnection(dbConfig);
    console.log('Database connection established.');

    // Check if NIO_USERS table exists
    if (!(await checkTableExists(connection, 'NIO_USERS'))) {
      return res.json({ success: false, message: 'NIO_USERS table does not exist.' });
    }

    // Check if required columns exist
    if (!(await checkColumnExists(connection, 'NIO_USERS', 'LOGIN_ID')) ||
        !(await checkColumnExists(connection, 'NIO_USERS', 'OFFICE_GROUP_ID'))) {
      return res.json({ success: false, message: 'One or more required columns do not exist in NIO_USERS.' });
    }

    // Check user credentials
    const userResult = await connection.execute(
      `SELECT NAME FROM USER$ WHERE NAME = :username AND PASSWORD = :password`,
      { username, password }
    );

    if (userResult.rows.length > 0) {
      // Retrieve OFFICE_GROUP_ID from NIO_USERS
      const officeResult = await connection.execute(
        `SELECT OFFICE_GROUP_ID FROM NIOGEMS_USERs.NIO_USERS WHERE LOGIN_ID = :loginId`,
        { loginId: username }
      );

      const officeGroupId = officeResult.rows.length > 0 ? officeResult.rows[0][0] : null;
      res.json({ success: true, message: 'Login successful!', officeGroupId });
    } else {
      res.json({ success: false, message: 'Invalid credentials' });
    }
  } catch (err) {
    console.error('Error occurred:', err.message);
    res.json({ success: false, message: err.message });
  } finally {
    if (connection) {
      try {
        await connection.close();
        console.log('Database connection closed.');
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});