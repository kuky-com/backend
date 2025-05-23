const Configs = require("../../models/configs");


async function getConfigs() {
  try {
    const configs = await Configs.findAll({
      raw: true
    });

    return {
      configs,
      message: 'Get configs successfully'
    };
  } catch (error) {
    console.error('Error getting configs:', error);
    throw error;
  }
}

async function updateConfig(key, value) {
  try {
    const config = await Configs.findOne({
      where: { key }
    });

    if (!config) {
      throw new Error('Config not found');
    }

    await config.update({ value });

    return {
      message: 'Config updated successfully'
    };
  } catch (error) {
    console.error('Error updating config:', error);
    throw error;
  }
}

module.exports = {
  getConfigs,
  updateConfig
};
