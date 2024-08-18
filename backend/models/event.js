const { Sequelize, DataTypes } = require('sequelize');
const sequelize = new Sequelize('mysql://tpsl:asdfqwer1!@tpsl1.cafe24.com:3306/TPSL');

const Event = sequelize.define('Event', {
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    start: {
        type: DataTypes.DATE,
        allowNull: false
    },
    end: {
        type: DataTypes.DATE,
        allowNull: false
    }
});

sequelize.sync();

module.exports = Event;
