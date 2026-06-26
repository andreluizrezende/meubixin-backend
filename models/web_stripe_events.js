'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class WebStripeEvents extends Model {}

  WebStripeEvents.init(
    {
      event_id: {
        type: DataTypes.STRING(255),
        primaryKey: true,
        allowNull: false
      },
      processed_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    },
    {
      sequelize,
      modelName: 'WebStripeEvents',
      tableName: 'web_stripe_events',
      timestamps: false
    }
  );

  return WebStripeEvents;
};
