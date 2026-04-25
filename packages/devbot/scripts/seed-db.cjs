const sql = require('mssql');

const config = {
    user: 'bettorsaceadmin',
    password: 'S3cur3P@ssw0rd!2026',
    server: 'sql-gamecade-bettorsace-cw.database.windows.net', 
    database: 'BettorsACELive',
    options: {
        encrypt: true, 
        trustServerCertificate: false 
    }
};

async function createTable() {
    try {
        await sql.connect(config);
        const result = await sql.query`
            CREATE TABLE DailyPicks (
                Id INT IDENTITY(1,1) PRIMARY KEY,
                Matchup NVARCHAR(255),
                Prediction NVARCHAR(255),
                ConfidenceScore INT,
                RecommendedBet NVARCHAR(255)
            );
            
            INSERT INTO DailyPicks (Matchup, Prediction, ConfidenceScore, RecommendedBet)
            VALUES 
                ('Lakers vs Nuggets', 'Lakers', 85, 'Lakers ML'),
                ('Celtics vs Heat', 'Celtics', 75, 'Celtics -5.5'),
                ('Warriors vs Suns', 'Warriors', 60, 'Over 225.5');
        `;
        console.log('Table created and data inserted:', result);
    } catch (err) {
        console.error('SQL error', err);
    } finally {
        await sql.close();
    }
}

createTable();