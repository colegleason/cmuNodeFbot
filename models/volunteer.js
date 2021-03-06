const bookshelf = require('../bookshelf')
const bot = require('../bot')
const handlers = require('../handlers')

const _ = require('lodash')

require('./deployment')
require('./task')
require('./base-model')
const Volunteer = bookshelf.model('BaseModel').extend({
	tableName: 'volunteers',
	idAttribute: 'fbid',
	currentTask: function() {
		return this.belongsTo('Task', 'current_task')
	},
	deployment: function() {
		return this.belongsTo('Deployment')
	},
	assignTask: function(task) {
  		return Promise.all([
  			this.save({currentTask: task.id}, {patch: true}),
  			task.save({volunteer_fbid: this.id}, {patch: true})
  		])
  		.then(() => {
  			this.sendMessage({text: `Your task should take ${task.estimatedTimeMin} minutes.`})
        	task.renderInstructions({fbid: this.id}).then(instructions => {
        		let currWait = 0
	       		const msgFn = this.sendMessage.bind(this)
        		instructions.forEach((i) => {
          			currWait = currWait + i.wait
          			setTimeout(msgFn, currWait*1000, i.message)
        		})
        		setTimeout(msgFn, (currWait+1)*1000, {text: "Once you understood the steps please write 's' when you start and then 'd' when you are done. You can also write 'r' if you want to not do the task before you have written 'd'. "})
        	})
      	})
	},
	getNewTask: function() {
		this.related('deployment').getTaskPool().then(pool => {
			const preAssigned = _.find(pool, p => {
				return p.get('volunteerFbid') == this.get('fbid')
			})
			if (preAssigned) {
				this.assignTask(preAssigned)
			}
    		else if (pool.length > 0) {
      			this.assignTask(pool.pop())
    		} else {
      			this.sendMessage({text: 'There are no tasks available right now.'})
    		}
  		})
	},
	getAverageExpertise: function() {
		return bookshelf.model('Task').collection()
		.query('where', 'volunteer_fbid', '=', this.get('fbid'))
		.query('where', 'completed', '=', true)
		.query('where', 'score', 'is not', null).fetch()
		.then(tasks => {
			const total = _.sum(tasks.map(t => t.get('score')))
			return tasks.length ? total / tasks.length : 0
		})
	},
	getAverageTime: function() {
		return bookshelf.model('Task').collection()
		.query('where', 'volunteer_fbid', '=', this.get('fbid'))
		.query('where', 'completed', '=', true)
		.query('where', 'completed_time', 'is not', null)
		.query('where', 'start_time', 'is not', null)
		.fetch().then(tasks => {
			const total = _.sum(tasks.map(t => t.timeScore))
			return tasks.length ? total / tasks.length : 0
		})
	},
	rejectTask: function() {
		return this.related('currentTask').fetch()
		.then((task) => {
			return Promise.all([
				this.save({currentTask: null}),
				task.save({volunteer_fbid: null, startTime: null}, {patch: true})
			])
		})
	},
	sendMessage: function(message) {
		bot.sendMessage(this.get('fbid'), message)
	},
	virtuals: {
		name: function() {
			return `${this.get('firstName')} ${this.get('lastName')}`
		}
	}
})

module.exports = bookshelf.model('Volunteer', Volunteer)