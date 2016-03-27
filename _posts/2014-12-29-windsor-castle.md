---
layout: gallery
title: Windsor Castle
category: photography
tags: Photography
thumbnail: /assets/photography/windsorcastle/windsorcastle-6.jpg
---

{% assign name = "windsorcastle" %}
{% for i in (1..7) %}
[![](/assets/photography/{{ name }}/{{ name }}-{{ i }}.jpg)](/assets/photography/{{ name }}/{{ name }}-{{ i }}.jpg)
{% endfor %}