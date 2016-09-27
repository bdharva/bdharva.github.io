---
layout: gallery
title: Fishing Camp
category: photography
tags: Photography
thumbnail: /assets/photography/fishingcamp/2014/fishing-3.jpg
---

{% assign name = "fishingcamp" %}
{% for i in (1..4) %}
[![](/assets/photography/{{ name }}/2014/fishing-{{ i }}.jpg)](/assets/photography/{{ name }}/2014/fishing-{{ i }}.jpg)
{% endfor %}