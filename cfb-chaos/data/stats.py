import csv
import collections
import sys

class Team:

	def __init__(self, name, rank, score):
		self.name = name
		self.rank = rank
		self.score = score

class TeamStat:

	def __init__(self, name, agentattempts, victimattempts, agent, victim):
		self.name = name
		self.agentattempts = agentattempts
		self.victimattempts = victimattempts
		self.agent = agent
		self.victim = victim

class WeekStat:
	def __init__(self, name, games, rankedgames, rankedlosses, upsets):
		self.name = name
		self.games = games
		self.rankedgames = rankedgames
		self.rankedlosses = rankedlosses
		self.upsets = upsets

class YearStat:
	def __init__(self, name):
		self.name = name
		self.years = {}

if __name__ == '__main__':

	startyear = 2002
	startweek = 1
	endweek = 16

	thisyear = sys.argv[1]
	thisweek = sys.argv[2]

	tracer = []

	for i in range(startweek, endweek+1):
		tracer.append([i, []])
		for j in range(startyear, thisyear+1):
			if j != thisyear:
				tracer[i-1][1].append(j)
			elif i < thisweek:
				tracer[i-1][1].append(j)

	yearseries = []
	weekseries = []
	teamseries = []

	for trace in tracer:
		week = trace[0]
		traceweek = YearStat(week)
		years = trace[1]
		for year in years:
			filename = 'exports/%s-week%s.csv' % (str(year), str(week))
			with open(filename, newline='') as infile:
				read = csv.reader(infile)
				for row in read:
					if row[0] != 'Year':
						away_team = row[2]
						away_rank = int(row[3])
						away_score = int(row[5])
						home_team = row[7]
						home_rank = int(row[8])
						home_score = int(row[10])
						upset = 0
						ranked_game = 0
						ranked_loss = 0
						favorite_added = False
						underdog_added = False
						week_added = False
						if away_rank > home_rank:
							underdog = Team(away_team, away_rank, away_score)
							favorite = Team(home_team, home_rank, home_score)
						else:
							underdog = Team(home_team, home_rank, home_score)
							favorite = Team(away_team, away_rank, away_score)
						if underdog.score > favorite.score:
							upset = 1
						if underdog.score < favorite.score and underdog.rank != 99:
							ranked_loss = 1
						if underdog.rank != 99 and favorite.rank != 99:
							ranked_game = 1
						for team in teamseries:
							if team.name == underdog.name:
								team.agentattempts = team.agentattempts+1
								team.agent = team.agent + upset
								underdog_added = True
							elif team.name == favorite.name:
								team.victimattempts = team.victimattempts+1
								team.victim = team.victim + upset
								favorite_added = True
						if underdog_added == False:
							teamseries.append(TeamStat(underdog.name,1,0,upset,0))
						if favorite_added == False:
							teamseries.append(TeamStat(favorite.name,0,1,0,upset))
						for w in weekseries:
							if w.name == week:
								w.games = w.games + 1
								w.upsets = w.upsets + upset
								w.rankedgames = w.rankedgames + ranked_game
								w.rankedlosses = w.rankedlosses + ranked_loss + upset
								week_added = True
						if week_added == False:
							weekseries.append(WeekStat(week, 1, ranked_game, ranked_loss+upset, upset))
						if year in traceweek.years:
							traceweek.years[year] += upset
						else:
							traceweek.years[year] = upset
			if year in traceweek.years:
				pass
			else:
				traceweek.years[year] = 0
		yearseries.append(traceweek)
	with open('stats/teams.csv', 'w') as outfile:
		writer=csv.writer(outfile, lineterminator='\n')
		writer.writerow(['Team', 'AgentAttempts', 'VictimAttempts', 'Agent', 'Victim'])
		for team in teamseries:
			if team.agent != 0 or team.victim != 0:
				writer.writerow([team.name, team.agentattempts, team.victimattempts, team.agent, team.victim])
	with open('stats/weeks.csv', 'w') as outfile:
		writer=csv.writer(outfile, lineterminator='\n')
		writer.writerow(['Week', 'Games', 'RankedGames', 'RankedLosses', 'Upsets'])
		for week in weekseries:
			writer.writerow([week.name, week.games, week.rankedgames, week.rankedlosses, week.upsets])
	for i in range(0, endweek-startweek+1):
		for j in range(startyear, thisyear+1):
			if i > 0:
				if j != thisyear:
					if j in yearseries[i].years:
						yearseries[i].years[j] += yearseries[i-1].years[j]
				elif i < thisweek-startweek:
					if j in yearseries[i].years:
						yearseries[i].years[j] += yearseries[i-1].years[j]
	with open('stats/years.csv', 'w') as outfile:
		writer=csv.writer(outfile, lineterminator='\n')
		headers = ['Week'] + sorted(yearseries[0].years)
		writer.writerow(headers)
		for line in yearseries:
			row = [line.name]
			for key, val in sorted(line.years.items()):
				row = row + [val]
			writer.writerow(row)
