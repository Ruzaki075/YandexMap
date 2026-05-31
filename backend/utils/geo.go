package utils

import "math"

const EarthRadiusM = 6371000

func HaversineMeters(lat1, lon1, lat2, lon2 float64) float64 {
	rad := math.Pi / 180
	φ1 := lat1 * rad
	φ2 := lat2 * rad
	dφ := (lat2 - lat1) * rad
	dλ := (lon2 - lon1) * rad
	a := math.Sin(dφ/2)*math.Sin(dφ/2) +
		math.Cos(φ1)*math.Cos(φ2)*math.Sin(dλ/2)*math.Sin(dλ/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return EarthRadiusM * c
}
