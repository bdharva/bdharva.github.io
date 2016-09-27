---
layout: gallery
title: Stone Mountain
category: photography
tags: Photography
thumbnail: /assets/photography/stonemountain/stonemountain-1.jpg
---

{% assign name = "stonemountain" %}
{% for i in (1..2) %}
[![](/assets/photography/{{ name }}/{{ name }}-{{ i }}.jpg)](/assets/photography/{{ name }}/{{ name }}-{{ i }}.jpg)
{% endfor %}