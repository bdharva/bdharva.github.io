import csv

if __name__ == '__main__':

	years = []
	weeks = []

	for num in range(2002,2015):
		years.append(num)

	for num in range(1,16):
		weeks.append(num)

	for year in years:
		for week in weeks:
			filename = 'exports/%s-week%s.csv' % (str(year), str(week))
			fixed = []
			with open(filename, newline='') as infile:
				read = csv.reader(infile)
				for row in read:
					if row[8] == row[3]:
						print('Rank error:', row[7])
						row[8] = 99
					if row[3] == '0':
						print('Rank error:', row[2])
						row[3] = '99'
					fixed.append(row)
			with open(filename, 'w') as outfile:
				writer=csv.writer(outfile, lineterminator='\n')
				for line in fixed:
					writer.writerow(line)
