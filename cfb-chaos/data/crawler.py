from html.parser import HTMLParser
import urllib.request
from urllib.request import urlopen
from urllib import parse
from selenium import webdriver
import csv
import time
import sys

class Team:

	def __init__(self, name, rank, record, score, home):
		self.name = name
		self.rank = rank
		self.record = record
		self.score = score
		self.home = home

class Matchup:

	def __init__(self, team1, team2):
		self.teams = []
		self.teams.append(team1, team2)

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
		self.in_total = False # td.total
		self.in_totalspan = False # span

		self.games = []
		self.teams = []
		self.name = ''
		self.rank = 99
		self.record = ''
		self.score = 0
		self.home = ''

	def handle_starttag(self, tag, attrs):

		if tag == 'section':
			if ('class', 'sb-score final') in attrs:
				self.in_score = True

		if tag == 'tbody' and self.in_score:
			if ('id', 'teams') in attrs:
				self.in_teams = True

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

		if tag == 'p' and self.in_teams:
			if ('class', 'record overall') in attrs:
				self.in_record = True

		if tag == 'td' and self.in_teams:
			if ('class', 'total') in attrs:
				self.in_total = True

		if tag == 'span' and self.in_total:
			self.in_totalspan = True

	def handle_data(self, data):

		if self.in_rank:
			self.rank = data

		if self.in_name:
			self.name = data

		if self.in_record:
			self.record = data

		if self.in_totalspan:
			self.score = data
			if self.in_home:
				self.home = 'Home'
				self.teams.append(Team(self.name, self.rank, self.record, self.score, self.home))
				self.games.append(self.teams)
			elif self.in_away:
				self.home = 'Away'
				self.teams.append(Team(self.name, self.rank, self.record, self.score, self.home))

	def handle_endtag(self, tag):

		if tag == 'section':
			self.in_score = False
			self.teams = []

		if tag == 'tbody':
			self.in_teams = False

		if tag == 'tr':
			self.in_away = False
			self.in_home = False
			self.name = ''
			self.rank = 99
			self.record = ''
			self.score = 0
			self.home = ''

		if tag == 'span':
			self.in_rank = False
			self.in_name = False
			self.in_totalspan = False

		if tag == 'p':
			self.in_record = False

		if tag == 'td':
			self.in_total = False

	def getResults(self, url):

		self.reset()
		self.feed(url)
		return self.games

if __name__ == '__main__':

	driver = webdriver.PhantomJS()

	year = sys.argv[1]
	week = sys.argv[2]

	url = 'http://www.espn.com/college-football/scoreboard/_/year/%s/seasontype/2/week/%s' % (str(year), str(week))
	print(url)
	with open('exports/' + str(year) + '-week' + str(week) + '.csv', 'w') as output:
		writer = csv.writer(output, lineterminator='\n')
		writer.writerow(['Year','Week','Team1','Team1Rank','Team1Record','Team1Score','Team1Home','Team2','Team2Rank','Team2Record','Team2Score','Team2Home'])
		driver.get(url)
		print('Starting extractor...')
		for result in Extractor().getResults(driver.page_source):
			print('Writing ' + result[0].name + ' vs. ' + result[1].name + '...')
			writer.writerow([year, week, result[0].name, result[0].rank, result[0].record, result[0].score, result[0].home, result[1].name, result[1].rank, result[1].record, result[1].score, result[1].home])
	print('Completed!')
