import csv

class Team:

	def __init__(self, name, agent, victim):
		self.name = name
		self.agent = agent
		self.victim = victim

if __name__ == '__main__':

	years = []
	weeks = []
	thisyear = 2016
	thisweek = 7
	thisweeks = []

	for num in range(1,17):
		weeks.append(num)

	for num in range(1,thisweek):
		thisweeks.append(num)

	for num in range(2002,2017):
		if num != thisyear:
			years.append([num, weeks])
		else:
			years.append([num, thisweeks])

	summary = []
	teams = []
	summaryweeks = []

	for year in years:
		i = 0
		y = year[0]
		ws = year[1]
		for w in ws:
			filename = 'exports/%s-week%s.csv' % (str(y), str(w))
			games = 0
			ranked_games = 0
			upsets = 0
			home_upsets = 0
			upset_margin = 0
			ranked_losses = 0
			with open(filename, newline='') as infile:
				read = csv.reader(infile)
				for row in read:
					if row[0] != 'Year':
						games = games + 1
						away_team = row[2]
						away_rank = int(row[3])
						away_score = int(row[5])
						home_team = row[7]
						home_rank = int(row[8])
						home_score = int(row[10])
						away_added = False
						home_added = False
						if away_rank != 99 and home_rank != 99:
							ranked_games = ranked_games + 1
						if away_rank != 99 and away_score < home_score:
							ranked_losses = ranked_losses + 1
						if home_rank != 99 and home_score < away_score:
							ranked_losses = ranked_losses + 1
						if away_score > home_score and away_rank > home_rank:
							upsets = upsets + 1
							home_upsets = home_upsets + 1
							upset_margin = upset_margin + (away_score - home_score)
							for team in teams:
								if team.name == away_team:
									team.agent = team.agent + 1
									away_added = True
								elif team.name == home_team:
									team.victim = team.victim + 1
									home_added = True
							if away_added == False:
								teams.append(Team(away_team,1,0))
								away_added = True
							if home_added == False:
								teams.append(Team(home_team,0,1))
								home_added = True
						if home_score > away_score and home_rank > away_rank:
							upsets = upsets + 1
							upset_margin = upset_margin + (home_score - away_score)
							for team in teams:
								if team.name == home_team:
									team.agent = team.agent + 1
									home_added = True
								elif team.name == away_team:
									team.victim = team.victim + 1
									away_added = True
							if home_added == False:
								teams.append(Team(home_team,1,0))
								home_added = True
							if away_added == False:
								teams.append(Team(away_team,0,1))
								away_added = True
						away_added = False
						home_added = False
				if (upsets != 0):
					upset_margin = upset_margin/upsets
				if i == 0 :
					cumulative = upsets
					cumulative2 = ranked_losses
				else:
					cumulative = upsets + summary[i-1][8]
					cumulative2 = ranked_losses + summary[i-1][9]
				summary.append([y, w, games, ranked_games, ranked_losses, upsets, home_upsets, upset_margin, cumulative, cumulative2])
				i = i + 1
		with open('summary-' + str(y) + '.csv', 'w') as outfile:
			writer=csv.writer(outfile, lineterminator='\n')
			writer.writerow(['Year', 'Week', 'Games', 'RankedGames', 'RankedLosses', 'Upsets', 'HomeUpsets', 'UpsetMargin', 'CumulativeUpsets', 'CumulativeRankedLosses'])
			for line in summary:
				writer.writerow(line)
		for newline in summary:
			added = False
			for line in summaryweeks:
				if line[0] == newline[1]:
					line[1] = line[1] + newline[2]
					line[2] = line[2] + newline[5]
					added = True
			if added == False:
				summaryweeks.append([newline[1], newline[2], newline[5]])
		summary = []
	with open('teams.csv', 'w') as outfile:
		writer=csv.writer(outfile, lineterminator='\n')
		writer.writerow(['Team', 'Agent', 'Victim'])
		for team in teams:
			writer.writerow([team.name, team.agent, team.victim])
	with open('weeks.csv', 'w') as outfile:
		writer=csv.writer(outfile, lineterminator='\n')
		writer.writerow(['Week', 'Games', 'Upsets'])
		for line in summaryweeks:
			writer.writerow(line)
