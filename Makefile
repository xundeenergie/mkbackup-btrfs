DIR=$(shell basename $(CURDIR))

VERSION=`gawk '$$1 == "Version:"{print $$2}' $(DIR)/DEBIAN/control`
ARCH=`gawk '$$1 == "Architecture:"{print $$2}' $(DIR)/DEBIAN/control`
COMMIT = $(shell date "+xe%Y%m%d_%H%M%S")

SUBDIRS := $(shell find $(DIR) -type d -print)
FILTER := $(abspath .git% %.deb .%)
FILTERORIG := $(abspath .git% %.deb) /DEBIAN%
FILES := $(filter-out $(FILTER), $(abspath $(shell find . -mindepth 1 -type f -print)))
ORIGS := $(filter-out $(FILTERORIG), $(realpath $(subst ./$(DIR),,$(shell find . -mindepth 2 -type f -print))))
FILESGIT := $(filter-out $(abspath .git%), $(abspath $(shell find . -mindepth 1 -type f -print)))

all: $(DIR)/DEBIAN/control 

$(DIR)/DEBIAN/control: $(FILES)
	echo DIR $(DIR)
	sed -e "s/^Version:.*/`gawk -f ../increment.awk $(DIR)/DEBIAN/control`/" $(DIR)/DEBIAN/control > $(DIR)/DEBIAN/control.tmp
	mv $(DIR)/DEBIAN/control.tmp $(DIR)/DEBIAN/control
	sudo dpkg-deb --build $(DIR) "$(DIR)_$(VERSION)_$(ARCH).deb"
	aptly repo add xundeenergie "$(DIR)_$(VERSION)_$(ARCH).deb"

update: 
	for i in $(ORIGS); do sudo cp -u $$i $(DIR)$$i;done

publish-git: $(FILESGIT)
	for i in $(FILESGIT);do echo $$i;done
	sudo git add .
	git commit -m $(COMMIT)
	git push origin master
	
