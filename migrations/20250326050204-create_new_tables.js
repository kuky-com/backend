'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.createTable('journey_categories', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        name: {
          type: Sequelize.STRING
        },
        question: {
          type: Sequelize.STRING
        },
        icon: {
          type: Sequelize.STRING,
          allowNull: true
        },
        image: {
          type: Sequelize.STRING,
          allowNull: true
        }
      }),
      queryInterface.createTable('journeys', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        name: {
          type: Sequelize.STRING
        },
        description: {
          type: Sequelize.STRING
        },
        example: {
          type: Sequelize.STRING,
          allowNull: true
        },
        jpf_question1: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'jpf_questions',
            key: 'id',
          },
          onDelete: 'CASCADE',
        },
        jpf_question2: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'jpf_questions',
            key: 'id',
          },
          onDelete: 'CASCADE',
        },
        jpf_video_question: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'jpf_questions',
            key: 'id',
          },
          onDelete: 'CASCADE',
        },
        icon: {
          type: Sequelize.STRING,
          allowNull: true
        },
        image: {
          type: Sequelize.STRING,
          allowNull: true
        },
        category: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'journey_catetories',
            key: 'id',
          },
          onDelete: 'CASCADE',
        }
      }),
      queryInterface.createTable('jpf_answers', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        question: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'jpf_questions',
            key: 'id',
          },
          onDelete: 'CASCADE',
        },
        content: {
          type: Sequelize.STRING
        },
        icon: {
          type: Sequelize.STRING,
          allowNull: true
        },
        image: {
          type: Sequelize.STRING,
          allowNull: true
        }
      }),
      queryInterface.createTable('jpf_questions', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        question: {
          type: Sequelize.STRING
        },
        question_type: {
          type: Sequelize.STRING, //multiple_choice, single_choice, text, one_to_ten
        },
        level_type: {
          type: Sequelize.STRING, //general, normal, video
        },
        icon: {
          type: Sequelize.STRING,
          allowNull: true
        },
        image: {
          type: Sequelize.STRING,
          allowNull: true
        }
      }),
      queryInterface.createTable('jpf_user_answers', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        user: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id',
          },
          onDelete: 'CASCADE',
        },
        question: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'jpf_questions',
            key: 'id',
          },
          onDelete: 'CASCADE',
        },
        answer: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'jpf_answers',
            key: 'id',
          },
          onDelete: 'CASCADE',
        },
      })
    ])
  },

  async down(queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.dropTable('journey_categories'),
      queryInterface.dropTable('journeys'),
      queryInterface.dropTable('jpf_answers'),
      queryInterface.dropTable('jpf_questions'),
      queryInterface.dropTable('jpf_user_answers'),
    ])
  },
};
