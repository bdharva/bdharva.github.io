from html.parser import HTMLParser
import urllib.request
from urllib.request import urlopen
from urllib import parse
from selenium import webdriver
import csv
import time
import sys

class Team:

	def __init__(self, name, rank, record, home):
		self.name = name
		self.rank = rank
		self.record = record
		self.home = home
		self.agent = ''
		self.attempts = 0
		self.success = 0

class Matchup:

	def __init__(self, teams, date, network, line, overunder):
		self.teams = teams
		self.date = date
		self.network = network
		self.line = line
		self.overunder = overunder

class Extractor(HTMLParser):

	def reset(self):

		HTMLParser.reset(self)

		self.in_score = False # section.sb-score
		self.in_teams = False # tbody#teams
		self.in_away = False # tr.away
		self.in_home = False # tr.home
		self.in_rank = False # span.rank
		self.in_name = False # span.sb-team-short
		self.in_record = False # p.record.overall
		self.in_network = False #th.network
		self.in_networkspan = False #span
		self.in_details = False #section.sb-detail
		self.in_stat = False #div.stat
		self.in_line = False #div
		self.in_overunder = False #div

		self.games = []
		self.teams = []
		self.name = ''
		self.rank = 99
		self.record = ''
		self.home = ''
		self.date = ''
		self.network = ''
		self.line = ''
		self.overunder = ''

	def handle_starttag(self, tag, attrs):

		if tag == 'section':
			if ('class', 'sb-score pregame') in attrs:
				self.in_score = True
			if ('class', 'sb-detail') in attrs:
				self.in_details = True
				print('In details...')

		if tag == 'tbody' and self.in_score:
			if ('id', 'teams') in attrs:
				self.in_teams = True

		if tag == 'th' and self.in_score:
			if ('class', 'date-time') in attrs:
				for attr in attrs:
					if attr[0] == 'data-date':
						self.date = attr[1]
			elif ('class', 'network') in attrs:
				self.in_network = True

		if tag == 'tr' and self.in_teams:
			if ('class', 'away') in attrs:
				self.in_away = True
			elif ('class', 'home') in attrs:
				self.in_home = True

		if tag == 'span' and self.in_teams:
			if ('class', 'rank') in attrs:
				self.in_rank = True
			elif ('class', 'sb-team-short') in attrs:
				self.in_name = True

		if tag == 'span' and self.in_network:
			self.in_networkspan = True

		if tag == 'p' and self.in_teams:
			if ('class', 'record overall') in attrs:
				self.in_record = True

		if tag == 'div' and self.in_details:
			if ('class', 'stat') in attrs:
				self.in_stat = True
			elif self.in_stat and not self.in_line:
				self.in_line = True
			elif self.in_stat and self.in_line:
				self.in_line = False
				self.in_overunder = True

	def handle_data(self, data):

		if self.in_networkspan:
			self.network = data

		if self.in_rank:
			self.rank = int(data)

		if self.in_name:
			self.name = data

		if self.in_record:
			self.record = data
			if self.in_home:
				self.home = 'Home'
				self.teams.append(Team(self.name, self.rank, self.record, self.home))
			elif self.in_away:
				self.home = 'Away'
				self.teams.append(Team(self.name, self.rank, self.record, self.home))

		if self.in_stat:
			print("In stat...")
			print(data)

		if self.in_line:
			self.line = data

		if self.in_overunder:
			self.overunder = data

	def handle_endtag(self, tag):

		if tag == 'section':
			if self.in_score:
				self.in_score = False
			elif self.in_details:
				self.in_details = False
				self.games.append(Matchup(self.teams, self.date, self.network, self.line, self.overunder))
				self.teams = []
				self.date = ''
				self.network = ''
				self.line = ''
				self.overunder = ''

		if tag == 'tbody':
			self.in_teams = False

		if tag == 'tr':
			self.in_away = False
			self.in_home = False
			self.name = ''
			self.rank = 99
			self.record = ''
			self.home = ''

		if tag == 'span':
			self.in_rank = False
			self.in_name = False
			self.in_networkspan = False

		if tag == 'p':
			self.in_record = False

		if tag == 'td':
			self.in_total = False

		if tag == 'th':
			self.in_network = False

		if tag == 'div':
			if self.in_overunder:
				self.in_overunder = False
				self.in_stat = False

	def getResults(self, url):

		self.reset()
		self.feed(url)
		return self.games

if __name__ == '__main__':

	driver = webdriver.PhantomJS()
	year = sys.argv[1]
	week = sys.argv[2]
	results = []
	url = 'http://www.espn.com/college-football/scoreboard/_/year/%s/seasontype/2/week/%s' % (str(year), str(week))
	print(url)
	driver.get(url)
	print('Starting extractor...')
	for result in Extractor().getResults(driver.page_source):
		try:
			test = result.teams[0].rank > result.teams[1].rank
			results.append(result)
			print(result)
		except IndexError:
			print('Skipped -- IndexError: list index out of range')
	for result in results:
		if result.teams[0].rank > result.teams[1].rank:
			result.teams[0].agent = "agent"
			result.teams[1].agent = "victim"
		else:
			result.teams[0].agent = "victim"
			result.teams[1].agent = "agent"
		print(result.teams[0].name + ": " + result.teams[0].agent)
		print(result.teams[1].name + ": " + result.teams[1].agent)
		with open('stats/teams.csv', newline='') as infile:
			read = csv.reader(infile)
			for row in read:
				pointer = 0
				if row[0] == result.teams[0].name:
					pointer = 1
				elif row[0] == result.teams[1].name:
					pointer = 2
				if pointer > 0:
					if result.teams[pointer-1].agent == "agent":
						result.teams[pointer-1].attempts = row[1]
						result.teams[pointer-1].success = row[3]
					elif result.teams[pointer-1].agent == "victim":
						result.teams[pointer-1].attempts = row[2]
						result.teams[pointer-1].success = row[4]
		print(results)
	with open('stats/matchups.csv', 'w') as output:
		writer = csv.writer(output, lineterminator='\n')
		writer.writerow(['Year','Week','Team1','Team1Rank','Team1Record','Team1Home','Team1Agent','Team1Attempts','Team1Success','Team2','Team2Rank','Team2Record','Team2Home','Team2Agent','Team2Attempts','Team2Success','Date','Network','Line','OverUnder'])
		for result in results:
			print('Writing ' + result.teams[0].name + ' vs. ' + result.teams[1].name + '...')
			writer.writerow([year, week, result.teams[0].name, result.teams[0].rank, result.teams[0].record, result.teams[0].home, result.teams[0].agent, result.teams[0].attempts, result.teams[0].success, result.teams[1].name, result.teams[1].rank, result.teams[1].record, result.teams[1].home, result.teams[1].agent, result.teams[1].attempts, result.teams[1].success, result.date, result.network, result.line, result.overunder])
	# time.sleep(10)
	print('Completed!')
